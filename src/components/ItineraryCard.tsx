import React, { useState } from "react";
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Edit2, 
  Plus, 
  ChevronDown, 
  ChevronUp,
  Utensils, 
  Compass, 
  Car, 
  ShoppingBag, 
  Ticket, 
  Bed, 
  HelpCircle,
  Check,
  X
} from "lucide-react";

// Types matching the API
interface Stop {
  id: string;
  time: string;
  activity: string;
  description: string;
  cost: string;
  locationName: string;
  category: "Food" | "Sightseeing" | "Transport" | "Shopping" | "Entertainment" | "Lodging" | "Other";
}

interface DayPlan {
  day: number;
  title: string;
  stops: Stop[];
}

interface TripItinerary {
  tripTitle: string;
  location: string;
  durationDays: number;
  summary: string;
  itinerary: DayPlan[];
}

interface ItineraryCardProps {
  itinerary: TripItinerary;
  onUpdateItinerary: (newItinerary: TripItinerary) => void;
}

export default function ItineraryCard({ itinerary, onUpdateItinerary }: ItineraryCardProps) {
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({ 1: true });
  const [editingStopId, setEditingStopId] = useState<string | null>(null);
  const [addingStopToDay, setAddingStopToDay] = useState<number | null>(null);

  // Edit Stop Form State
  const [editForm, setEditForm] = useState<Partial<Stop>>({});

  // Add Stop Form State
  const [addForm, setAddForm] = useState<Partial<Stop>>({
    time: "10:00 AM",
    activity: "",
    description: "",
    cost: "Free",
    locationName: itinerary.location,
    category: "Sightseeing"
  });

  const toggleDay = (dayNum: number) => {
    setExpandedDays(prev => ({
      ...prev,
      [dayNum]: !prev[dayNum]
    }));
  };

  // Reorder stop within a day
  const handleReorder = (dayIndex: number, stopIndex: number, direction: "up" | "down") => {
    const updated = JSON.parse(JSON.stringify(itinerary)) as TripItinerary;
    const day = updated.itinerary[dayIndex];
    if (!day) return;

    const targetIndex = direction === "up" ? stopIndex - 1 : stopIndex + 1;
    if (targetIndex < 0 || targetIndex >= day.stops.length) return;

    // Swap stops
    const temp = day.stops[stopIndex];
    day.stops[stopIndex] = day.stops[targetIndex];
    day.stops[targetIndex] = temp;

    onUpdateItinerary(updated);
  };

  // Remove a stop
  const handleRemove = (dayIndex: number, stopIndex: number) => {
    const updated = JSON.parse(JSON.stringify(itinerary)) as TripItinerary;
    const day = updated.itinerary[dayIndex];
    if (!day) return;

    day.stops.splice(stopIndex, 1);
    onUpdateItinerary(updated);
  };

  // Open inline edit mode
  const startEdit = (stop: Stop) => {
    setEditingStopId(stop.id);
    setEditForm(stop);
  };

  // Save edited stop
  const saveEdit = (dayIndex: number, stopIndex: number) => {
    const updated = JSON.parse(JSON.stringify(itinerary)) as TripItinerary;
    const day = updated.itinerary[dayIndex];
    if (!day) return;

    day.stops[stopIndex] = {
      ...day.stops[stopIndex],
      ...editForm
    } as Stop;

    onUpdateItinerary(updated);
    setEditingStopId(null);
  };

  // Add new custom stop
  const handleAddStop = (dayIndex: number) => {
    if (!addForm.activity || addForm.activity.trim() === "") return;

    const updated = JSON.parse(JSON.stringify(itinerary)) as TripItinerary;
    const day = updated.itinerary[dayIndex];
    if (!day) return;

    const newStop: Stop = {
      id: `custom-stop-${Date.now()}`,
      time: addForm.time || "12:00 PM",
      activity: addForm.activity,
      description: addForm.description || "",
      cost: addForm.cost || "Free",
      locationName: addForm.locationName || itinerary.location,
      category: (addForm.category as any) || "Sightseeing"
    };

    day.stops.push(newStop);
    onUpdateItinerary(updated);

    // Reset Form
    setAddingStopToDay(null);
    setAddForm({
      time: "10:00 AM",
      activity: "",
      description: "",
      cost: "Free",
      locationName: itinerary.location,
      category: "Sightseeing"
    });
  };

  // Helper to render category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Food": return <Utensils size={14} className="cat-icon cat-food" />;
      case "Sightseeing": return <Compass size={14} className="cat-icon cat-sight" />;
      case "Transport": return <Car size={14} className="cat-icon cat-trans" />;
      case "Shopping": return <ShoppingBag size={14} className="cat-icon cat-shop" />;
      case "Entertainment": return <Ticket size={14} className="cat-icon cat-ent" />;
      case "Lodging": return <Bed size={14} className="cat-icon cat-lodg" />;
      default: return <HelpCircle size={14} className="cat-icon cat-other" />;
    }
  };

  return (
    <div className="itinerary-card-container">
      <div className="itinerary-header-details">
        <h2 className="trip-itinerary-title">{itinerary.tripTitle}</h2>
        <div className="trip-location-badge">
          <MapPin size={14} />
          <span>{itinerary.location} • {itinerary.durationDays} Days</span>
        </div>
        <p className="trip-summary-text">{itinerary.summary}</p>
      </div>

      <div className="day-accordion-list">
        {itinerary.itinerary.map((dayPlan, dayIdx) => {
          const isExpanded = expandedDays[dayPlan.day] !== false;
          
          return (
            <div key={dayPlan.day} className={`day-accordion-item ${isExpanded ? "active" : ""}`}>
              {/* Day Header */}
              <button 
                className="day-header-button" 
                onClick={() => toggleDay(dayPlan.day)}
                aria-expanded={isExpanded}
              >
                <div className="day-header-title-wrapper">
                  <span className="day-badge">Day {dayPlan.day}</span>
                  <h3 className="day-header-title">{dayPlan.title}</h3>
                </div>
                <div className="day-header-actions">
                  <span className="stops-count-badge">{dayPlan.stops.length} stops</span>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </button>

              {/* Day Contents */}
              {isExpanded && (
                <div className="day-content-panel">
                  {dayPlan.stops.length === 0 ? (
                    <div className="empty-stops-placeholder">
                      <p>No stops planned for this day yet. Add one below!</p>
                    </div>
                  ) : (
                    <div className="stops-timeline-list">
                      {dayPlan.stops.map((stop, stopIdx) => {
                        const isEditing = editingStopId === stop.id;

                        if (isEditing) {
                          return (
                            <div key={stop.id} className="stop-item stop-editing-card">
                              <div className="edit-form-grid">
                                <div className="edit-input-group">
                                  <label>Time</label>
                                  <input 
                                    type="text" 
                                    value={editForm.time || ""} 
                                    onChange={e => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                  />
                                </div>
                                <div className="edit-input-group">
                                  <label>Category</label>
                                  <select 
                                    value={editForm.category || "Sightseeing"} 
                                    onChange={e => setEditForm(prev => ({ ...prev, category: e.target.value as any }))}
                                  >
                                    <option value="Sightseeing">Sightseeing</option>
                                    <option value="Food">Food</option>
                                    <option value="Transport">Transport</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Entertainment">Entertainment</option>
                                    <option value="Lodging">Lodging</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>
                                <div className="edit-input-group span-2">
                                  <label>Activity Name</label>
                                  <input 
                                    type="text" 
                                    value={editForm.activity || ""} 
                                    onChange={e => setEditForm(prev => ({ ...prev, activity: e.target.value }))}
                                  />
                                </div>
                                <div className="edit-input-group">
                                  <label>Location</label>
                                  <input 
                                    type="text" 
                                    value={editForm.locationName || ""} 
                                    onChange={e => setEditForm(prev => ({ ...prev, locationName: e.target.value }))}
                                  />
                                </div>
                                <div className="edit-input-group">
                                  <label>Cost</label>
                                  <input 
                                    type="text" 
                                    value={editForm.cost || ""} 
                                    onChange={e => setEditForm(prev => ({ ...prev, cost: e.target.value }))}
                                  />
                                </div>
                                <div className="edit-input-group span-2">
                                  <label>Description</label>
                                  <textarea 
                                    rows={2}
                                    value={editForm.description || ""} 
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="edit-card-actions">
                                <button className="btn btn-sm btn-success" onClick={() => saveEdit(dayIdx, stopIdx)}>
                                  <Check size={14} />
                                  <span>Save</span>
                                </button>
                                <button className="btn btn-sm btn-outline" onClick={() => setEditingStopId(null)}>
                                  <X size={14} />
                                  <span>Cancel</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={stop.id} className="stop-item">
                            {/* Time Connector */}
                            <div className="stop-timeline-indicator">
                              <div className="timeline-dot"></div>
                              <div className="timeline-line"></div>
                            </div>

                            {/* Stop Details */}
                            <div className="stop-card">
                              <div className="stop-card-main">
                                <div className="stop-meta-row">
                                  <span className="stop-time">
                                    <Clock size={12} />
                                    {stop.time}
                                  </span>
                                  <span className={`category-tag tag-${stop.category.toLowerCase()}`}>
                                    {getCategoryIcon(stop.category)}
                                    {stop.category}
                                  </span>
                                </div>

                                <h4 className="stop-activity-title">{stop.activity}</h4>
                                {stop.description && <p className="stop-description">{stop.description}</p>}

                                <div className="stop-extra-details">
                                  <span className="stop-location">
                                    <MapPin size={12} />
                                    {stop.locationName}
                                  </span>
                                  <span className="stop-cost">
                                    <DollarSign size={12} />
                                    {stop.cost}
                                  </span>
                                </div>
                              </div>

                              {/* Stop Reorder / Edit Actions */}
                              <div className="stop-card-actions">
                                <div className="reorder-button-group">
                                  <button 
                                    className="action-btn" 
                                    onClick={() => handleReorder(dayIdx, stopIdx, "up")}
                                    disabled={stopIdx === 0}
                                    title="Move stop up"
                                    aria-label="Move stop up"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button 
                                    className="action-btn" 
                                    onClick={() => handleReorder(dayIdx, stopIdx, "down")}
                                    disabled={stopIdx === dayPlan.stops.length - 1}
                                    title="Move stop down"
                                    aria-label="Move stop down"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                </div>

                                <div className="management-button-group">
                                  <button 
                                    className="action-btn action-edit" 
                                    onClick={() => startEdit(stop)}
                                    title="Edit stop"
                                    aria-label="Edit stop"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    className="action-btn action-delete" 
                                    onClick={() => handleRemove(dayIdx, stopIdx)}
                                    title="Delete stop"
                                    aria-label="Delete stop"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Stop Panel */}
                  <div className="add-stop-section">
                    {addingStopToDay === dayPlan.day ? (
                      <div className="add-stop-form-card">
                        <h5>Add New Stop</h5>
                        <div className="edit-form-grid">
                          <div className="edit-input-group">
                            <label>Time</label>
                            <input 
                              type="text" 
                              value={addForm.time || ""} 
                              onChange={e => setAddForm(prev => ({ ...prev, time: e.target.value }))}
                              placeholder="e.g. 02:00 PM"
                            />
                          </div>
                          <div className="edit-input-group">
                            <label>Category</label>
                            <select 
                              value={addForm.category || "Sightseeing"} 
                              onChange={e => setAddForm(prev => ({ ...prev, category: e.target.value as any }))}
                            >
                              <option value="Sightseeing">Sightseeing</option>
                              <option value="Food">Food</option>
                              <option value="Transport">Transport</option>
                              <option value="Shopping">Shopping</option>
                              <option value="Entertainment">Entertainment</option>
                              <option value="Lodging">Lodging</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="edit-input-group span-2">
                            <label>Activity Name*</label>
                            <input 
                              type="text" 
                              value={addForm.activity || ""} 
                              onChange={e => setAddForm(prev => ({ ...prev, activity: e.target.value }))}
                              placeholder="e.g. Afternoon Tea at Harrods"
                              required
                            />
                          </div>
                          <div className="edit-input-group">
                            <label>Location</label>
                            <input 
                              type="text" 
                              value={addForm.locationName || ""} 
                              onChange={e => setAddForm(prev => ({ ...prev, locationName: e.target.value }))}
                              placeholder="Address or neighborhood"
                            />
                          </div>
                          <div className="edit-input-group">
                            <label>Cost</label>
                            <input 
                              type="text" 
                              value={addForm.cost || ""} 
                              onChange={e => setAddForm(prev => ({ ...prev, cost: e.target.value }))}
                              placeholder="e.g. £25, Free"
                            />
                          </div>
                          <div className="edit-input-group span-2">
                            <label>Description</label>
                            <textarea 
                              rows={2}
                              value={addForm.description || ""} 
                              onChange={e => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Add details about what to do, see or eat here."
                            />
                          </div>
                        </div>
                        <div className="edit-card-actions">
                          <button 
                            className="btn btn-sm btn-primary" 
                            onClick={() => handleAddStop(dayIdx)}
                            disabled={!addForm.activity || addForm.activity.trim() === ""}
                          >
                            <Plus size={14} />
                            <span>Add Stop</span>
                          </button>
                          <button className="btn btn-sm btn-outline" onClick={() => setAddingStopToDay(null)}>
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-dashed btn-add-stop" 
                        onClick={() => setAddingStopToDay(dayPlan.day)}
                      >
                        <Plus size={14} />
                        <span>Add Stop to Day {dayPlan.day}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
