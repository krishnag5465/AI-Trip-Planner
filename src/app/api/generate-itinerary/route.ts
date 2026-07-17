import { NextRequest, NextResponse } from "next/server";

// Bypass local SSL certificate verification (resolves UNABLE_TO_VERIFY_LEAF_SIGNATURE behind corporate proxies/firewalls)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Define the shape of a stop
interface Stop {
  id: string;
  time: string;
  activity: string;
  description: string;
  cost: string;
  locationName: string;
  category: "Food" | "Sightseeing" | "Transport" | "Shopping" | "Entertainment" | "Lodging" | "Other";
}

// Define the shape of a day's itinerary
interface DayPlan {
  day: number;
  title: string;
  stops: Stop[];
}

// Define the shape of the full trip
interface TripItinerary {
  tripTitle: string;
  location: string;
  durationDays: number;
  summary: string;
  itinerary: DayPlan[];
}

// System Instruction to guide the Gemini model
const SYSTEM_INSTRUCTION = `You are an expert travel planner. You plan detailed, realistic, and highly engaging day-by-day travel itineraries.
You must return only a JSON object that strictly adheres to the requested schema. Do not wrap the JSON output in markdown code blocks (e.g., do not use \`\`\`json ... \`\`\`).
Provide realistic timings (e.g. 09:00 AM, 02:00 PM), estimated costs (e.g. Free, $15, 2000 JPY), and categorise each stop into one of: "Food", "Sightseeing", "Transport", "Shopping", "Entertainment", "Lodging", "Other".
Generate unique alphanumeric IDs for each stop (e.g., stop-1-1, stop-1-2).`;

// Structured schema for Gemini API
const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tripTitle: { type: "STRING" },
    location: { type: "STRING" },
    durationDays: { type: "INTEGER" },
    summary: { type: "STRING" },
    itinerary: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          day: { type: "INTEGER" },
          title: { type: "STRING" },
          stops: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                time: { type: "STRING" },
                activity: { type: "STRING" },
                description: { type: "STRING" },
                cost: { type: "STRING" },
                locationName: { type: "STRING" },
                category: {
                  type: "STRING",
                  enum: ["Food", "Sightseeing", "Transport", "Shopping", "Entertainment", "Lodging", "Other"]
                }
              },
              required: ["id", "time", "activity", "description", "cost", "locationName", "category"]
            }
          }
        },
        required: ["day", "title", "stops"]
      }
    }
  },
  required: ["tripTitle", "location", "durationDays", "summary", "itinerary"]
};

// Helper to generate a deterministic hash from location name
function getDeterministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// Mock Itinerary Generator in case GEMINI_API_KEY is not configured
function generateMockItinerary(prompt: string, currentItinerary?: TripItinerary): TripItinerary {
  const query = prompt.toLowerCase();
  
  // If we are performing a refinement, modify the current itinerary based on prompt keywords
  if (currentItinerary) {
    const updated = JSON.parse(JSON.stringify(currentItinerary)) as TripItinerary;
    
    if (query.includes("remove") || query.includes("delete")) {
      // Try to remove a stop if name matched
      for (const day of updated.itinerary) {
        const index = day.stops.findIndex(s => query.includes(s.activity.toLowerCase()) || query.includes(s.id.toLowerCase()));
        if (index !== -1) {
          day.stops.splice(index, 1);
          updated.summary += " (Adjusted: Removed stop per request)";
          return updated;
        }
      }
    }
    
    // Add a stop if requested
    if (query.includes("add") || query.includes("insert") || query.includes("put")) {
      const targetDay = updated.itinerary[0];
      if (targetDay) {
        targetDay.stops.push({
          id: `stop-${Date.now()}`,
          time: "04:00 PM",
          activity: "Custom Stop",
          description: "Manually added during mock refinement loop.",
          cost: "Free",
          locationName: updated.location,
          category: "Sightseeing"
        });
        updated.summary += " (Adjusted: Added a new stop)";
        return updated;
      }
    }

    // Default refinement response
    updated.summary += ` (Refined based on instruction: "${prompt}")`;
    if (updated.itinerary[0] && updated.itinerary[0].stops[0]) {
      updated.itinerary[0].stops[0].description += " (Mock refined: Adjusted settings based on your follow-up request)";
    }
    return updated;
  }

  // Preset Itineraries
  // Tokyo, Japan
  if (query.includes("tokyo") || query.includes("japan")) {
    return {
      tripTitle: "Gourmet Tokyo Exploration",
      location: "Tokyo, Japan",
      durationDays: 3,
      summary: "A brief tour of Tokyo's neon streets, historic temples, and legendary sushi bars, optimized for foodies.",
      itinerary: [
        {
          day: 1,
          title: "Shinjuku Lights & Izakaya Crawl",
          stops: [
            {
              id: "stop-1-1",
              time: "03:00 PM",
              activity: "Check-in at Gracery Hotel Shinjuku",
              description: "Check into your hotel, famous for the giant Godzilla head, and refresh.",
              cost: "18,000 JPY",
              locationName: "Shinjuku, Tokyo",
              category: "Lodging"
            },
            {
              id: "stop-1-2",
              time: "06:00 PM",
              activity: "Dinner in Omoide Yokocho",
              description: "Explore narrow lanes and sample grilled yakitori skewers and draft beer in a cozy local alleyway.",
              cost: "3,000 JPY",
              locationName: "Omoide Yokocho, Shinjuku",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "08:30 PM",
              activity: "Metropolitan Government Building Observatory",
              description: "View the vast, glittering expanse of Tokyo from the 45th floor panoramic deck.",
              cost: "Free",
              locationName: "Tocho, Nishi-Shinjuku",
              category: "Sightseeing"
            }
          ]
        },
        {
          day: 2,
          title: "Sushi, Temples & Electronics",
          stops: [
            {
              id: "stop-2-1",
              time: "09:00 AM",
              activity: "Sushi Breakfast at Tsukiji Outer Market",
              description: "Walk through market stalls and sample fresh tuna nigiri, tamagoyaki, and street seafood.",
              cost: "4,000 JPY",
              locationName: "Tsukiji Outer Market",
              category: "Food"
            },
            {
              id: "stop-2-2",
              time: "11:30 AM",
              activity: "Senso-ji Temple Visit",
              description: "Tokyo's oldest Buddhist temple in historic Asakusa. Walk down Nakamise Shopping Street.",
              cost: "Free",
              locationName: "Asakusa, Tokyo",
              category: "Sightseeing"
            },
            {
              id: "stop-2-3",
              time: "03:00 PM",
              activity: "Akihabara Electric Town Walk",
              description: "Immerse yourself in anime, gaming, electronics, and themed cafes.",
              cost: "Free",
              locationName: "Akihabara, Tokyo",
              category: "Shopping"
            }
          ]
        },
        {
          day: 3,
          title: "Fashion & Shrines of Harajuku",
          stops: [
            {
              id: "stop-3-1",
              time: "10:00 AM",
              activity: "Meiji Jingu Shrine Stroll",
              description: "Walk through the massive wooden torii gates and serene forest paths to Tokyo's grandest Shinto shrine.",
              cost: "Free",
              locationName: "Yoyogikoen, Shibuya",
              category: "Sightseeing"
            },
            {
              id: "stop-3-2",
              time: "01:00 PM",
              activity: "Takeshita Street Crepe Lunch",
              description: "Savor a colourful, sweet crepe while checking out eccentric street fashion and quirky boutiques.",
              cost: "1,200 JPY",
              locationName: "Harajuku, Tokyo",
              category: "Food"
            },
            {
              id: "stop-3-3",
              time: "03:30 PM",
              activity: "Shibuya Crossing & Hachiko",
              description: "Cross the world's busiest pedestrian intersection and see the famous loyal dog monument.",
              cost: "Free",
              locationName: "Shibuya Station, Tokyo",
              category: "Sightseeing"
            }
          ]
        }
      ]
    };
  }

  // Paris, France
  if (query.includes("paris") || query.includes("france")) {
    return {
      tripTitle: "Art & Romance in Paris",
      location: "Paris, France",
      durationDays: 2,
      summary: "A romantic 2-day itinerary featuring iconic sights, museums, and classic French bistros.",
      itinerary: [
        {
          day: 1,
          title: "Landmarks & Seine Cruise",
          stops: [
            {
              id: "stop-1-1",
              time: "09:30 AM",
              activity: "Eiffel Tower Ascent",
              description: "Climb or take the lift to the summit for breathtaking 360-degree views of Paris.",
              cost: "€28",
              locationName: "Champ de Mars, Paris",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "01:00 PM",
              activity: "Lunch at Cafe de Flore",
              description: "Have a classic Croque Monsieur and café au lait at a historic writers' hangout.",
              cost: "€25",
              locationName: "Saint-Germain-des-Prés",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "03:30 PM",
              activity: "Seine River Cruise",
              description: "Relax on a 1-hour cruise viewing Notre-Dame, the Louvre, and bridges from the water.",
              cost: "€15",
              locationName: "Bateaux Parisiens Dock",
              category: "Entertainment"
            }
          ]
        },
        {
          day: 2,
          title: "Masterpieces & Montmartre",
          stops: [
            {
              id: "stop-2-1",
              time: "09:00 AM",
              activity: "Louvre Museum Tour",
              description: "Enter via the glass pyramid to witness the Mona Lisa, Venus de Milo, and Winged Victory.",
              cost: "€22",
              locationName: "Rue de Rivoli, Paris",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "02:00 PM",
              activity: "Sacré-Cœur & Montmartre Stroll",
              description: "Hike up the cobblestone hills to see the white-domed basilica and street artists at Place du Tertre.",
              cost: "Free",
              locationName: "Montmartre, Paris",
              category: "Sightseeing"
            }
          ]
        }
      ]
    };
  }

  // London, United Kingdom
  if (query.includes("london") || query.includes("uk") || query.includes("england")) {
    return {
      tripTitle: "Royal London & West End Heritage",
      location: "London, United Kingdom",
      durationDays: 3,
      summary: "Discover the historic landmarks of Westminster, experience a world-class West End show, and enjoy traditional afternoon tea.",
      itinerary: [
        {
          day: 1,
          title: "Royals & Westminster Landmarks",
          stops: [
            {
              id: "stop-1-1",
              time: "09:30 AM",
              activity: "Buckingham Palace Ceremony",
              description: "Watch the famous Changing of the Guard ceremony outside the royal gates.",
              cost: "Free",
              locationName: "Westminster, London",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "01:00 PM",
              activity: "Lunch at Westminster Tavern",
              description: "Enjoy a traditional British pub lunch of fish and chips and local ale.",
              cost: "£18",
              locationName: "Tothill St, London",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "03:00 PM",
              activity: "Westminster Abbey & Big Ben",
              description: "Explore the historic coronation site and take photos of the iconic Big Ben clock.",
              cost: "£27",
              locationName: "Parliament Square, London",
              category: "Sightseeing"
            }
          ]
        },
        {
          day: 2,
          title: "British History & West End Theatre",
          stops: [
            {
              id: "stop-2-1",
              time: "10:00 AM",
              activity: "British Museum Tour",
              description: "Witness ancient treasures including the Rosetta Stone and Parthenon Sculptures.",
              cost: "Free",
              locationName: "Great Russell St, London",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "01:30 PM",
              activity: "Afternoon Tea at Fortnum & Mason",
              description: "Indulge in warm scones, clotted cream, finger sandwiches, and premium tea.",
              cost: "£45",
              locationName: "Piccadilly, London",
              category: "Food"
            },
            {
              id: "stop-2-3",
              time: "07:30 PM",
              activity: "West End Musical Performance",
              description: "Experience an award-winning musical like Les Misérables or Phantom of the Opera.",
              cost: "£65",
              locationName: "Shaftesbury Ave, London",
              category: "Entertainment"
            }
          ]
        },
        {
          day: 3,
          title: "Market Shopping & South Bank Views",
          stops: [
            {
              id: "stop-3-1",
              time: "10:00 AM",
              activity: "Borough Market Food Crawl",
              description: "Sample local cheeses, gourmet pies, and international treats at London's oldest food market.",
              cost: "£15",
              locationName: "Southwark, London",
              category: "Food"
            },
            {
              id: "stop-3-2",
              time: "02:00 PM",
              activity: "The London Eye Flight",
              description: "Take a 30-minute flight in a glass capsule for amazing views over the River Thames.",
              cost: "£38",
              locationName: "Lambeth, London",
              category: "Entertainment"
            }
          ]
        }
      ]
    };
  }

  // New York City
  if (query.includes("new york") || query.includes("nyc") || query.includes("manhattan") || query.includes("america")) {
    return {
      tripTitle: "New York City: Manhattan Essentials",
      location: "New York City, USA",
      durationDays: 3,
      summary: "Take in the stunning views from the Empire State Building, stroll through Central Park, and watch a live Broadway show.",
      itinerary: [
        {
          day: 1,
          title: "Midtown Sights & Broadway",
          stops: [
            {
              id: "stop-1-1",
              time: "09:00 AM",
              activity: "Empire State Building Observatory",
              description: "Take the high-speed elevator to the 86th floor for sweeping views of the Manhattan skyline.",
              cost: "$48",
              locationName: "34th St & 5th Ave",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "12:30 PM",
              activity: "Joe's Pizza Slice Lunch",
              description: "Grab a classic New York style thin-crust cheese pizza slice in Greenwich Village.",
              cost: "$8",
              locationName: "Carmine St, NYC",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "07:00 PM",
              activity: "Broadway Musical Show",
              description: "Watch a world-famous theater production in the heart of Times Square.",
              cost: "$95",
              locationName: "Theater District, Broadway",
              category: "Entertainment"
            }
          ]
        },
        {
          day: 2,
          title: "Central Park & Museum Mile",
          stops: [
            {
              id: "stop-2-1",
              time: "10:00 AM",
              activity: "Central Park Walking Tour",
              description: "Walk through Bethesda Terrace, Bow Bridge, and enjoy a peaceful morning.",
              cost: "Free",
              locationName: "Central Park, Manhattan",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "01:00 PM",
              activity: "The Metropolitan Museum of Art",
              description: "Browse thousands of years of art history across massive galleries.",
              cost: "$30",
              locationName: "5th Ave & 82nd St",
              category: "Sightseeing"
            }
          ]
        },
        {
          day: 3,
          title: "Statue of Liberty & Brooklyn Bridge",
          stops: [
            {
              id: "stop-3-1",
              time: "09:00 AM",
              activity: "Statue of Liberty Ferry",
              description: "Ride the ferry to Liberty Island and Ellis Island to learn about immigration history.",
              cost: "$25",
              locationName: "Battery Park, NYC",
              category: "Sightseeing"
            },
            {
              id: "stop-3-2",
              time: "02:00 PM",
              activity: "Brooklyn Bridge Walk & DUMBO",
              description: "Walk across the historic suspension bridge and take photos from Pebble Beach.",
              cost: "Free",
              locationName: "Brooklyn Bridge, NYC",
              category: "Sightseeing"
            }
          ]
        }
      ]
    };
  }

  // Rome, Italy
  if (query.includes("rome") || query.includes("italy")) {
    return {
      tripTitle: "Ancient History & Pasta in Rome",
      location: "Rome, Italy",
      durationDays: 2,
      summary: "Walk in the footsteps of Gladiators at the Colosseum, marvel at the Sistine Chapel, and savor Roman pasta classics.",
      itinerary: [
        {
          day: 1,
          title: "Gladiators & Baroque Rome",
          stops: [
            {
              id: "stop-1-1",
              time: "09:00 AM",
              activity: "Colosseum & Roman Forum Tour",
              description: "Take a guided walk through the ancient amphitheater and the heart of old Rome.",
              cost: "€24",
              locationName: "Piazza del Colosseo",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "01:30 PM",
              activity: "Lunch at Da Enzo al 29",
              description: "Savor a traditional Roman pasta like Cacio e Pepe or Carbonara in Trastevere.",
              cost: "€20",
              locationName: "Trastevere, Rome",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "04:30 PM",
              activity: "Trevi Fountain & Pantheon Stroll",
              description: "Toss a coin into the fountain and walk under the dome of Rome's best preserved temple.",
              cost: "Free",
              locationName: "Rome Historic Center",
              category: "Sightseeing"
            }
          ]
        },
        {
          day: 2,
          title: "Vatican Treasures & Roman Sunset",
          stops: [
            {
              id: "stop-2-1",
              time: "08:30 AM",
              activity: "Vatican Museums & Sistine Chapel",
              description: "Admire Michelangelo's ceiling frescoes and the stunning collections of art.",
              cost: "€22",
              locationName: "Vatican City",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "03:00 PM",
              activity: "Gelato Break at Giolitti",
              description: "Sample Rome's legendary artisan gelato in a historic parlor.",
              cost: "€5",
              locationName: "Via Uffici del Vicario",
              category: "Food"
            }
          ]
        }
      ]
    };
  }

  // Banaras / Varanasi, India
  if (query.includes("banaras") || query.includes("varanasi") || query.includes("kashi")) {
    return {
      tripTitle: "Spiritual Varanasi: Ghats & Temples",
      location: "Varanasi, India",
      durationDays: 2,
      summary: "Immerse yourself in India's spiritual capital: witness the mesmerizing Ganga Aarti, tour ancient temples, and cruise the sacred Ganges at sunrise.",
      itinerary: [
        {
          day: 1,
          title: "Sacred Ghats & Ganga Aarti",
          stops: [
            {
              id: "stop-1-1",
              time: "11:00 AM",
              activity: "Kashi Vishwanath Temple Darshan",
              description: "Visit the revered golden temple dedicated to Lord Shiva, the spiritual heart of Kashi.",
              cost: "Free",
              locationName: "Lahori Tola, Varanasi",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "01:30 PM",
              activity: "Kachori Sabzi Breakfast & Lunch",
              description: "Taste Varanasi's famous street snacks: piping hot kachoris with aloo sabzi and sweet jalebi.",
              cost: "100 INR",
              locationName: "Kachori Gali, Varanasi",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "05:30 PM",
              activity: "Ganga Aarti at Dashashwamedh Ghat",
              description: "Witness the spectacular evening prayer ritual performed with fire, incense, and chants on the river steps.",
              cost: "Free",
              locationName: "Dashashwamedh Ghat, Varanasi",
              category: "Entertainment"
            }
          ]
        },
        {
          day: 2,
          title: "Sunrise Boat Ride & Sarnath History",
          stops: [
            {
              id: "stop-2-1",
              time: "05:15 AM",
              activity: "Sunrise Boat Cruise",
              description: "Take a peaceful rowing boat ride on the Ganges as the sun rises, observing morning bathing and ceremonies on the ghats.",
              cost: "300 INR",
              locationName: "Assi Ghat, Varanasi",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "11:00 AM",
              activity: "Sarnath Buddhist Site Excursion",
              description: "Visit the archaeological park and Dhamekh Stupa, where Lord Buddha gave his first sermon.",
              cost: "20 INR",
              locationName: "Sarnath, Varanasi",
              category: "Sightseeing"
            },
            {
              id: "stop-2-3",
              time: "03:30 PM",
              activity: "Banarasi Silk Weaving Tour",
              description: "Observe local craftsmen weaving world-famous Banarasi silk sarees on traditional wooden handlooms.",
              cost: "Free",
              locationName: "Pili Kothi, Varanasi",
              category: "Shopping"
            }
          ]
        }
      ]
    };
  }

  // Ujjain, India
  if (query.includes("ujjain") || query.includes("mahakal")) {
    return {
      tripTitle: "Sacred Ujjain: The Land of Mahakal",
      location: "Ujjain, India",
      durationDays: 2,
      summary: "Seek blessings at the Mahakaleshwar Jyotirlinga, explore historic temples on the banks of Shipra river, and experience the local culture.",
      itinerary: [
        {
          day: 1,
          title: "Divine Mahakal & Shipra Aarti",
          stops: [
            {
              id: "stop-1-1",
              time: "08:00 AM",
              activity: "Mahakaleshwar Temple Visit",
              description: "Seek blessings at the famous Jyotirlinga shrine, known for its unique swayambhu (self-manifested) deity.",
              cost: "Free",
              locationName: "Mahakal Marg, Ujjain",
              category: "Sightseeing"
            },
            {
              id: "stop-1-2",
              time: "01:00 PM",
              activity: "Traditional Dal Bafla Lunch",
              description: "Dine on traditional Madhya Pradesh cuisine: baked wheat baflas dipped in ghee, served with dal and laddu.",
              cost: "250 INR",
              locationName: "Nanakheda, Ujjain",
              category: "Food"
            },
            {
              id: "stop-1-3",
              time: "05:30 PM",
              activity: "Sunset & Shipra Aarti at Ram Ghat",
              description: "Relax at the river banks during sunset and witness the daily evening oil-lamp prayers.",
              cost: "Free",
              locationName: "Ram Ghat, Ujjain",
              category: "Sightseeing"
            }
          ]
        },
        {
          day: 2,
          title: "Ancient Temples & Science",
          stops: [
            {
              id: "stop-2-1",
              time: "09:30 AM",
              activity: "Kal Bhairav Temple",
              description: "Visit the unique temple of Kal Bhairav where liquor is offered to the deity as prasad.",
              cost: "Free",
              locationName: "Jail Road, Ujjain",
              category: "Sightseeing"
            },
            {
              id: "stop-2-2",
              time: "12:00 PM",
              activity: "Harsiddhi Temple Darshan",
              description: "Visit one of the 51 Shakti Peethas, famous for its two tall stone lamp towers illuminated in evenings.",
              cost: "Free",
              locationName: "Near Ram Ghat, Ujjain",
              category: "Sightseeing"
            },
            {
              id: "stop-2-3",
              time: "03:00 PM",
              activity: "Vedh Shala (Observatory)",
              description: "Explore the ancient observatory built by Maharaja Jai Singh II, featuring stone astronomical instruments.",
              cost: "20 INR",
              locationName: "Chintaman Ganes Marg, Ujjain",
              category: "Sightseeing"
            }
          ]
        }
      ]
    };
  }

  // Dynamic hashed fallback generator for any other location
  const capitalizedLocation = prompt
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
    .replace(/[^\w\s]/g, "")
    .trim() || "Your Destination";

  const hash = getDeterministicHash(capitalizedLocation);

  // List of unique activity templates
  const sightseeingActivities = [
    { title: "Old Town Heritage Walk", desc: "Take a guided walking tour through historic quarters to discover unique architecture and local stories.", cost: "Free" },
    { title: "Panoramic View Skydeck", desc: "Ascend to the tallest local viewing platform to take in sweeping views of the skyline and surrounding landscape.", cost: "$15" },
    { title: "Scenic Waterfront Tour", desc: "Take a relaxing cruise or walk along the harbor/riverfront to admire the city views from the water.", cost: "$25" },
    { title: "Botanical Garden & Lake Stroll", desc: "Walk through tranquil pathways lined with exotic plants, serene water ponds, and ancient trees.", cost: "Free" },
    { title: "Historic Landmark Exploration", desc: "Visit the most iconic monument of the area to learn about its history and capture beautiful photos.", cost: "$10" },
    { title: "Local History & Arts Museum", desc: "Browse exhibits featuring archaeological artifacts, regional craft histories, and classic paintings.", cost: "$12" }
  ];

  const foodActivities = [
    { title: "Traditional Street Food Tasting", desc: "Navigate bustling market stalls to sample traditional snacks, pastries, and local drinks.", cost: "$18" },
    { title: "Rooftop Sunset Bistro Dinner", desc: "Dine at a highly recommended local restaurant offering traditional specialties and panoramic views.", cost: "$40" },
    { title: "Artisan Bakery & Cafe Crawl", desc: "Indulge in fresh pastries and freshly brewed local coffee at a historic neighborhood hangout.", cost: "$10" },
    { title: "Traditional Breakfast Buffet", desc: "Savor a hearty breakfast of local staples, fresh fruits, and hot beverages to fuel your day.", cost: "$12" }
  ];

  const shoppingActivities = [
    { title: "Crafts & Souvenirs Market", desc: "Explore local vendor stalls to find handmade crafts, spices, and unique souvenirs to take home.", cost: "Free entry" },
    { title: "High-Street Boulevard Shopping", desc: "Walk down the main commercial avenue lined with popular shops, boutique labels, and galleries.", cost: "Free entry" }
  ];

  const entertainmentActivities = [
    { title: "Live Music & Cultural Performance", desc: "Attend an evening show showcasing traditional dances, folk music, or live acoustic jazz.", cost: "$30" },
    { title: "Central Park Performance", desc: "Watch street artists, musicians, and live performers in the town's central community park.", cost: "Free" }
  ];

  // Select activities deterministically based on hash
  const getIndex = (arr: any[], offset: number) => (hash + offset) % arr.length;

  const day1_stop1 = sightseeingActivities[getIndex(sightseeingActivities, 1)];
  const day1_stop2 = foodActivities[getIndex(foodActivities, 2)];
  const day1_stop3 = shoppingActivities[getIndex(shoppingActivities, 3)];

  const day2_stop1 = sightseeingActivities[getIndex(sightseeingActivities, 4)];
  const day2_stop2 = foodActivities[getIndex(foodActivities, 5)];
  const day2_stop3 = entertainmentActivities[getIndex(entertainmentActivities, 6)];

  return {
    tripTitle: `Exploration of ${capitalizedLocation}`,
    location: capitalizedLocation,
    durationDays: 2,
    summary: `A customized 2-day plan highlighting the best attractions, dining, and activities in ${capitalizedLocation}, deterministically simulated for mock mode.`,
    itinerary: [
      {
        day: 1,
        title: "Heritage & Local Flavour",
        stops: [
          {
            id: "stop-1-1",
            time: "10:00 AM",
            activity: day1_stop1.title,
            description: day1_stop1.desc.replace("local", capitalizedLocation).replace("the city", capitalizedLocation),
            cost: day1_stop1.cost,
            locationName: `${capitalizedLocation} Center`,
            category: "Sightseeing"
          },
          {
            id: "stop-1-2",
            time: "01:00 PM",
            activity: day1_stop2.title,
            description: day1_stop2.desc.replace("local", capitalizedLocation),
            cost: day1_stop2.cost,
            locationName: `${capitalizedLocation} Food Court`,
            category: "Food"
          },
          {
            id: "stop-1-3",
            time: "04:30 PM",
            activity: day1_stop3.title,
            description: day1_stop3.desc,
            cost: day1_stop3.cost,
            locationName: `${capitalizedLocation} Bazaar`,
            category: "Shopping"
          }
        ]
      },
      {
        day: 2,
        title: "Arts, Culture & Sunset Views",
        stops: [
          {
            id: "stop-2-1",
            time: "10:00 AM",
            activity: day2_stop1.title,
            description: day2_stop1.desc.replace("local", capitalizedLocation).replace("the city", capitalizedLocation),
            cost: day2_stop1.cost,
            locationName: `${capitalizedLocation} Museum District`,
            category: "Sightseeing"
          },
          {
            id: "stop-2-2",
            time: "01:30 PM",
            activity: day2_stop2.title,
            description: day2_stop2.desc.replace("local", capitalizedLocation),
            cost: day2_stop2.cost,
            locationName: `${capitalizedLocation} Old Street`,
            category: "Food"
          },
          {
            id: "stop-2-3",
            time: "07:00 PM",
            activity: day2_stop3.title,
            description: day2_stop3.desc,
            cost: day2_stop3.cost,
            locationName: `${capitalizedLocation} Cultural Theatre`,
            category: "Entertainment"
          }
        ]
      }
    ]
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, currentItinerary } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return NextResponse.json(
        { error: "Trip description prompt is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Resilience/Fallback: If no API key is set, use the interactive mock engine
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not configured in environment variables. Falling back to Mock Generator.");
      // Introduce a slight artificial delay to simulate network latency for loading state verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      const mockResult = generateMockItinerary(prompt, currentItinerary);
      return NextResponse.json(mockResult);
    }

    // Build the prompt for LLM call
    let promptContent = "";
    if (currentItinerary) {
      promptContent = `You are refining an existing travel itinerary based on the user's instructions.
Current Itinerary:
${JSON.stringify(currentItinerary, null, 2)}

User Instruction for Modification:
"${prompt}"

Please modify the itinerary according to the instructions. Ensure you keep the structure intact. You can add new stops, delete stops, change day titles, adjust descriptions, etc. You must maintain the duration (unless the user explicitly asked to change the number of days). Return the complete, updated itinerary.`;
    } else {
      promptContent = `Please create a detailed travel itinerary based on the following description:
"${prompt}"

Structure the itinerary day-by-day. Ensure every stop is complete and contains valid fields. Make the experience unique, detailed and authentic to the location.`;
    }

    // Call Gemini API using native fetch
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: promptContent }]
            }
          ],
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_RESPONSE_SCHEMA,
            temperature: 0.2 // Low temperature for consistent JSON schema adherence
          }
        }),
        // Add a 30s timeout signal
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error (HTTP ${response.status}):`, errorText);
      return NextResponse.json(
        { error: `AI generation failed (HTTP ${response.status}). Please check your API key or try again.` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(
        { error: "The AI model returned an empty response. Please retry." },
        { status: 502 }
      );
    }

    // Try parsing the text content returned by Gemini
    let tripItinerary: TripItinerary;
    try {
      tripItinerary = JSON.parse(rawText.trim());
    } catch (parseErr) {
      console.error("Malformed JSON returned by Gemini:", rawText);
      return NextResponse.json(
        { error: "The AI model output could not be parsed as valid JSON. Retrying may yield correct results." },
        { status: 502 }
      );
    }

    // Validate the shape of the parsed JSON
    if (
      !tripItinerary.tripTitle ||
      !tripItinerary.location ||
      !Array.isArray(tripItinerary.itinerary)
    ) {
      console.error("Parsed itinerary lacks required structure:", tripItinerary);
      return NextResponse.json(
        { error: "The AI response did not match the expected structure. Please retry." },
        { status: 502 }
      );
    }

    // Ensure all stops have unique IDs if Gemini failed to generate them
    let stopCounter = 1;
    tripItinerary.itinerary.forEach((day, dayIndex) => {
      day.day = day.day || (dayIndex + 1);
      day.title = day.title || `Day ${day.day}`;
      if (Array.isArray(day.stops)) {
        day.stops.forEach(stop => {
          if (!stop.id) {
            stop.id = `stop-${day.day}-${stopCounter++}`;
          }
          stop.time = stop.time || "12:00 PM";
          stop.activity = stop.activity || "Sightseeing stop";
          stop.description = stop.description || "";
          stop.cost = stop.cost || "Free";
          stop.locationName = stop.locationName || tripItinerary.location;
          stop.category = stop.category || "Sightseeing";
        });
      } else {
        day.stops = [];
      }
    });

    return NextResponse.json(tripItinerary);
  } catch (error: any) {
    console.error("Exception in generate-itinerary API:", error);
    const isTimeout = error.name === "TimeoutError" || error.message?.includes("timeout");
    return NextResponse.json(
      { error: isTimeout ? "The request timed out. Please try a shorter itinerary or retry." : "A server error occurred while planning your trip." },
      { status: isTimeout ? 504 : 500 }
    );
  }
}
