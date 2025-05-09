import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBack from "./NavBack";

import "./Contacts.css";

function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [user, setUser] = useState(null);
  // Default conversation data
  const defaultConversationData = [
    {"text": "Hello", "timestamp": "2025-03-20T09:30:00.000000"},
    {"text": "hi", "timestamp": "2025-03-20T09:30:15.000000"},
  ];
  const [newContact, setNewContact] = useState({
    name: "",
    email: "",
    phone: "",
    isEmergency: false,
    photo_url: "",
    conversation_data: defaultConversationData // Initialize with default conversation data
  });
  const [editContact, setEditContact] = useState({
    name: "",
    email: "",
    phone: "",
    isEmergency: false,
    photo_url: "",
    conversation_data: []
  });
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [externalNotificationStatus, setExternalNotificationStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Get user from localStorage
    const userString = localStorage.getItem("user");
    if (userString) {
      try {
        const userData = JSON.parse(userString);
        setUser(userData);
      } catch (err) {
        console.error("Error parsing user data:", err);
        setError("Error loading user data");
      }
    } else {
      // Redirect to login if no user found
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    if (user?.user_id) {
      fetchContacts();
    }
  }, [user]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/contacts/${user.user_id}`);
      
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        setContacts(data.contacts);
      } else {
        setError("Failed to load contacts");
      }
    } catch (err) {
      setError("An error occurred while fetching contacts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e, isEdit = false) => {
    const { name, value, type, checked } = e.target;
    const contactToUpdate = isEdit ? editContact : newContact;
    const setContactFunction = isEdit ? setEditContact : setNewContact;
    
    setContactFunction({ 
      ...contactToUpdate, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };

  const uploadImageToBackend = async (file) => {
    try {
      setUploadingImage(true);
      
      // Create form data for the image upload
      const formData = new FormData();
      formData.append("image", file);
      
      // Upload to our backend, which will handle the ImgBB upload
      const response = await fetch("http://localhost:5000/api/upload-image", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        return data.imageUrl;
      } else {
        throw new Error(data.error || "Image upload failed");
      }
    } catch (err) {
      console.error("Image upload error:", err);
      throw err;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // Create temporary object URL for preview
      const previewUrl = URL.createObjectURL(file);
      
      if (isEdit) {
        setEditContact({ 
          ...editContact, 
          photo_url: previewUrl, // Temporary URL for preview only
          file: file // Store the file object for later upload
        });
      } else {
        setNewContact({ 
          ...newContact, 
          photo_url: previewUrl, // Temporary URL for preview only
          file: file // Store the file object for later upload
        });
      }
    } catch (err) {
      console.error("Error creating preview:", err);
      setError("Error creating image preview");
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!newContact.name) {
      setError("Contact name is required");
      return;
    }

    // Basic email validation
    if (newContact.email && !validateEmail(newContact.email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      setExternalNotificationStatus(null);
      
      // Upload the image if provided
      let imageUrl = "";
      if (newContact.file) {
        imageUrl = await uploadImageToBackend(newContact.file);
      }
      
      // Now create the contact with the permanent image URL and conversation data
      const contactData = {
        name: newContact.name,
        email: newContact.email,
        phone: newContact.phone,
        isEmergency: newContact.isEmergency,
        photo_url: imageUrl, // Use the permanent URL from ImgBB
        user_id: user.user_id,
        user_name: user.name || "Unknown", // Store the user's name
        conversation_data: defaultConversationData // Always use the default conversation data
      };

      const response = await fetch('http://localhost:5000/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        fetchContacts();
        setShowAddModal(false);
        setNewContact({
          name: "",
          email: "",
          phone: "",
          isEmergency: false,
          photo_url: "",
          conversation_data: defaultConversationData // Reset with default conversation data
        });
        setError(""); // Clear any previous errors
        
        // Handle external notification status
        if (data.external_notification) {
          setExternalNotificationStatus(data.external_notification);
          
          // Show status for a few seconds then clear it
          setTimeout(() => {
            setExternalNotificationStatus(null);
          }, 5000);
        }
      } else {
        setError(data.error || "Failed to add contact");
      }
    } catch (err) {
      setError("An error occurred while adding the contact: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async (e) => {
    e.preventDefault();
    
    // Validate input
    if (!editContact.name) {
      setError("Contact name is required");
      return;
    }

    // Basic email validation
    if (editContact.email && !validateEmail(editContact.email)) {
      setError("Please enter a valid email address");
      return;
    }

    try {
      setLoading(true);
      
      // Create a copy of the contact data to update
      const contactData = { ...editContact };
      
      // Upload the new image if provided
      if (editContact.file) {
        const imageUrl = await uploadImageToBackend(editContact.file);
        contactData.photo_url = imageUrl;
      }
      
      // Remove file property before sending to backend
      delete contactData.file;
      
      const response = await fetch(`http://localhost:5000/api/contacts/${editContact._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        fetchContacts();
        setShowEditModal(false);
        setError(""); // Clear any previous errors
      } else {
        setError(data.error || "Failed to update contact");
      }
    } catch (err) {
      setError("An error occurred while updating the contact: " + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };

  const handleDeleteContact = async (contactId) => {
    if (window.confirm("Are you sure you want to delete this contact?")) {
      try {
        const response = await fetch(`http://localhost:5000/api/contacts/${contactId}`, {
          method: 'DELETE'
        });
        
        // Check if response is ok before parsing JSON
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          fetchContacts();
        } else {
          setError(data.error || "Failed to delete contact");
        }
      } catch (err) {
        setError("An error occurred while deleting the contact");
        console.error(err);
      }
    }
  };

  const handleViewConversation = (contact) => {
    setSelectedContact(contact);
    setShowConversationModal(true);
  };
  
  const handleEditButtonClick = (contact) => {
    // Make a deep copy of the contact to avoid modifying the original
    setEditContact({
      ...contact,
      // Don't include file property as we don't have the file object, only the URL
    });
    setShowEditModal(true);
  };

  const formatTimestamp = (timestamp) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch (err) {
      console.error("Error formatting timestamp:", err);
      return timestamp; // Return the original timestamp if formatting fails
    }
  };

  // If user is not loaded yet, show loading
  if (!user) {
    return <div className="loading">Loading user data...</div>;
  }

  return (
    <div className="contacts-page">
      <NavBack />
      <div className="contacts-container">
        <h1>My Contacts</h1>
        
        {error && <div className="error-message">{error}</div>}
        
        {externalNotificationStatus && (
          <div className={`notification-message ${externalNotificationStatus === 'succeeded' ? 'success' : 'warning'}`}>
            External notification {externalNotificationStatus}
          </div>
        )}
        
        <button 
          className="add-contact-btn" 
          onClick={() => setShowAddModal(true)}
        >
          <i className="add-icon">+</i> Add New Contact
        </button>
        
        {loading ? (
          <div className="loading">Loading contacts...</div>
        ) : (
          <div className="contacts-grid">
            {contacts.length === 0 ? (
              <p className="no-contacts">No contacts found. Add some!</p>
            ) : (
              contacts.map((contact) => (
                <div className="contact-card" key={contact._id}>
                  <div className="contact-photo">
                    {contact.photo_url ? (
                      <img src={contact.photo_url} alt={contact.name} />
                    ) : (
                      <div className="placeholder-photo">{contact.name.charAt(0)}</div>
                    )}
                    {contact.isEmergency && (
                      <span className="emergency-badge">Emergency</span>
                    )}
                  </div>
                  <div className="contact-info">
                    <h3>{contact.name}</h3>
                    {contact.email && <p><strong>Email:</strong> {contact.email}</p>}
                    {contact.phone && <p><strong>Phone:</strong> {contact.phone}</p>}
                    {contact.user_name && (
                      <p className="added-by">Added by: {contact.user_name}</p>
                    )}
                  </div>
                  <div className="contact-actions">
                    <button 
                      className="edit-btn"
                      onClick={() => handleEditButtonClick(contact)}
                      title="Edit Contact"
                    >
                      <i className="edit-icon">✏️</i>
                    </button>
                    <button 
                      className="view-conversation-btn"
                      onClick={() => handleViewConversation(contact)}
                      title="View Conversation"
                    >
                      <i className="conversation-icon">💬</i>
                    </button>
                    <button 
                      className="delete-btn"
                      onClick={() => handleDeleteContact(contact._id)}
                      title="Delete Contact"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add New Contact</h2>
              <button 
                className="close-btn"
                onClick={() => setShowAddModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleAddContact}>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newContact.name}
                  onChange={(e) => handleInputChange(e, false)}
                  placeholder="Contact Name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={newContact.email}
                  onChange={(e) => handleInputChange(e, false)}
                  placeholder="Email Address"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={newContact.phone}
                  onChange={(e) => handleInputChange(e, false)}
                  placeholder="Phone Number"
                />
              </div>
              
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="isEmergency"
                  name="isEmergency"
                  checked={newContact.isEmergency}
                  onChange={(e) => handleInputChange(e, false)}
                />
                <label htmlFor="isEmergency">Emergency Contact</label>
              </div>
              
              <div className="form-group">
                <label htmlFor="photo">Photo</label>
                <input
                  type="file"
                  id="photo"
                  name="photo"
                  onChange={(e) => handleFileChange(e, false)}
                  accept="image/*"
                />
                {newContact.photo_url && (
                  <div className="preview-photo">
                    <img src={newContact.photo_url} alt="Preview" />
                  </div>
                )}
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary-btn"
                  disabled={uploadingImage || loading}
                >
                  {uploadingImage ? "Uploading..." : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Contact Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Contact</h2>
              <button 
                className="close-btn"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleEditContact}>
              <div className="form-group">
                <label htmlFor="edit-name">Name *</label>
                <input
                  type="text"
                  id="edit-name"
                  name="name"
                  value={editContact.name}
                  onChange={(e) => handleInputChange(e, true)}
                  placeholder="Contact Name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  type="email"
                  id="edit-email"
                  name="email"
                  value={editContact.email}
                  onChange={(e) => handleInputChange(e, true)}
                  placeholder="Email Address"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-phone">Phone Number</label>
                <input
                  type="tel"
                  id="edit-phone"
                  name="phone"
                  value={editContact.phone}
                  onChange={(e) => handleInputChange(e, true)}
                  placeholder="Phone Number"
                />
              </div>
              
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="edit-isEmergency"
                  name="isEmergency"
                  checked={editContact.isEmergency}
                  onChange={(e) => handleInputChange(e, true)}
                />
                <label htmlFor="edit-isEmergency">Emergency Contact</label>
              </div>
              
              <div className="form-group">
                <label htmlFor="edit-photo">Photo</label>
                <input
                  type="file"
                  id="edit-photo"
                  name="photo"
                  onChange={(e) => handleFileChange(e, true)}
                  accept="image/*"
                />
                {editContact.photo_url && (
                  <div className="preview-photo">
                    <img src={editContact.photo_url} alt="Preview" />
                  </div>
                )}
                <small className="photo-note">Leave empty to keep current photo</small>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary-btn"
                  disabled={uploadingImage || loading}
                >
                  {uploadingImage ? "Uploading..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conversation Modal */}
      {showConversationModal && selectedContact && (
        <div className="modal-overlay">
          <div className="modal conversation-modal">
            <div className="modal-header">
              <h2>Conversation with {selectedContact.name}</h2>
              <button 
                className="close-btn"
                onClick={() => setShowConversationModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="conversation-container">
              {selectedContact.conversation_data && selectedContact.conversation_data.length > 0 ? (
                <div className="conversation-messages">
                  {selectedContact.conversation_data.map((message, index) => (
                    <div key={index} className="message">
                      <div className="message-text">{message.text}</div>
                      <div className="message-timestamp">{formatTimestamp(message.timestamp)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-conversation">No conversation history available.</p>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="close-modal-btn"
                onClick={() => setShowConversationModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Contacts;