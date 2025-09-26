import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import '../styles/message.css';
import Sidebar from "./Sidebar";
import { supabase } from '../utils/supabaseClient';
import { useAuth } from "../context/AuthContext";
import { useNavigate } from 'react-router-dom'; 
import defaultProfile from "/public/default_profile.png"; 
import { FaTrash } from 'react-icons/fa';
import Swal from 'sweetalert2';

const Message = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("inbox");
  const [recipientIdentifier, setRecipientIdentifier] = useState("");
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');
  const [recipientSuggestions, setRecipientSuggestions] = useState([]);
  const [selectedRecipientUser, setSelectedRecipientUser] = useState(null);
  const [messageBody, setMessageBody] = useState('');
  const [conversations, setConversations] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState(new Set());
  const fetchMessagesRef = useRef();

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      if (activeTab === "inbox") {
        const { data: conversationsData, error: fetchError } = await supabase
          .rpc('get_conversations', { p_user_id: user.id });

        if (fetchError) throw fetchError;

        const conversationList = (conversationsData || []).map(c => ({
          otherUser: {
            id: c.other_user_id,
            first_name: c.other_user_first_name,
            last_name: c.other_user_last_name,
            profile_picture: c.other_user_profile_picture,
          },
          latestMessage: {
            id: c.latest_message_id,
            content: c.latest_message_content,
            created_at: c.latest_message_created_at,
            sender_id: c.latest_message_sender_id,
            read: c.latest_message_read,
            file_url: c.latest_message_file_url,
            file_name: c.latest_message_file_name,
          },
          unreadCount: c.unread_count,
        }));
        
        setConversations(conversationList);
      }
    } catch (err) {
      console.error(`Error fetching ${activeTab} messages:`, err.message);
      setError(`Failed to load ${activeTab} messages. ${err.message}`);
    } finally {
      setLoading(false);
      setCurrentPage(1);
    }
  }, [user, activeTab]);

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages;
  }, [fetchMessages]);

  useEffect(() => {
    if (selectedRecipientUser) { 
      setRecipientSuggestions([]);
      return;
    }
    if (recipientSearchQuery.trim().length < 2) {
      setRecipientSuggestions([]);
      setSearchError('');
      return;
    }

    const searchUsers = async () => {
      setLoading(true); 
      setSearchError('');
      try {
        const searchTerm = `%${recipientSearchQuery.trim()}%`;
        const { data, error: searchDbError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, school_id, profile_picture')
          .or(`first_name.ilike.${searchTerm},last_name.ilike.${searchTerm},school_id.ilike.${searchTerm},email.ilike.${searchTerm}`)
          .neq('id', user.id)
          .limit(5);

        if (searchDbError) throw searchDbError;
        setRecipientSuggestions(data || []);
        if (!data || data.length === 0) {
          setSearchError('No users found.');
        }
      } catch (err) {
        console.error("Error searching recipients:", err.message);
        setSearchError('Failed to search users.');
        setRecipientSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchUsers();
    }, 500); 

    return () => clearTimeout(debounceTimer);
  }, [recipientSearchQuery, user?.id, selectedRecipientUser]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-for-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `or(sender_id.eq.${user.id},receiver_id.eq.${user.id})` },
        (payload) => {
          console.log('New message received via WebSocket!', payload);
          fetchMessagesRef.current?.(); 
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const handleSend = async () => {
    if (!selectedRecipientUser) {
      setError("Please select a recipient.");
      return;
    }
    if (!messageBody.trim()) {
      setError("Message body cannot be empty.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: insertError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedRecipientUser.id,
          content: messageBody.trim(),
        });

      if (insertError) throw insertError;

      Swal.fire({
        icon: 'success',
        title: 'Message Sent!',
        showConfirmButton: false,
        timer: 1500
      });
      setRecipientIdentifier("");
      setRecipientSearchQuery("");
      setMessageBody("");
      setSelectedRecipientUser(null);
      setActiveTab("inbox");
      fetchMessages();
    } catch (err) {
      console.error("Error sending message:", err.message);
      setError(`Failed to send message: ${err.message}`);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Failed to send message: ${err.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecipientSelect = (recipient) => {
    setSelectedRecipientUser(recipient);
    setRecipientIdentifier(
      `${recipient.first_name} ${recipient.last_name} (${
        recipient.email || recipient.school_id
      })`
    );
    setRecipientSearchQuery("");
    setRecipientSuggestions([]);
  };

  const toggleSelection = (conversationId) => {
    setSelectedConversations(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(conversationId)) {
        newSelection.delete(conversationId);
      } else {
        newSelection.add(conversationId);
      }
      return newSelection;
    });
  };

  const toggleSelectAll = () => {
    if (selectedConversations.size === currentConversations.length) {
      setSelectedConversations(new Set());
    } else {
      const allConversationIds = new Set(currentConversations.map(c => c.otherUser.id));
      setSelectedConversations(allConversationIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedConversations.size === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Selection',
        text: 'Please select conversations to delete.',
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `This will permanently delete ${selectedConversations.size} conversation(s) for BOTH users. This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, delete them!'
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const deletePromises = Array.from(selectedConversations).map(otherUserId =>
        supabase
          .from('messages')
          .delete()
          .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      );

      const results = await Promise.all(deletePromises);
      const someFailed = results.some(res => res.error);

      if (someFailed) {
        throw new Error("Some conversations could not be deleted.");
      }

      Swal.fire(
        'Deleted!',
        'Selected conversations have been deleted.',
        'success'
      );
      await fetchMessages(); 
    } catch (err) {
      console.error("Error deleting conversations:", err);
      setError(`Failed to delete conversations: ${err.message}`);
      Swal.fire(
        'Error!',
        `Failed to delete conversations: ${err.message}`,
        'error'
      );
    } finally {
      setLoading(false);
      setSelectionMode(false);
      setSelectedConversations(new Set());
    }
  };

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const totalItems = conversations.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentConversations = conversations.slice(indexOfFirstItem, indexOfLastItem);

  const isAllSelected = useMemo(() => {
    if (currentConversations.length === 0) return false;
    return selectedConversations.size === currentConversations.length;
  }, [selectedConversations, currentConversations]);



  return (
    <div className="message-container">
      <Sidebar />
      <h2 className="message-title">Messages</h2>

      <div className="message-tabs">
        <button
          className={activeTab === "inbox" ? "active" : ""}
          onClick={() => setActiveTab("inbox")}
        >
          📥 Inbox
        </button>
        <button
          className={activeTab === "new" ? "active" : ""}
          onClick={() => setActiveTab("new")}
        >
          ✉️ New Message
        </button>
      </div>

      <div className="message-card">
        {error && <p className="error-message" style={{color: 'red', textAlign: 'center', marginBottom: '1rem'}}>{error}</p>}

        {activeTab === 'inbox' && (
          <div className="tab-content fadeIn">
            <div className="inbox-header">
              <h3 className="subheading">Inbox</h3>
              {!selectionMode ? (
                <button onClick={() => setSelectionMode(true)} className="manage-btn">Manage</button>
              ) : (
                <div className="selection-controls">
                  <button onClick={handleDeleteSelected} className="delete-selected-btn" title="Delete Selected">
                    <FaTrash />
                  </button>
                  <button onClick={() => { setSelectionMode(false); setSelectedConversations(new Set()); }} className="cancel-selection-btn">Cancel</button>
                </div>
              )}
            </div>
            {selectionMode && currentConversations.length > 0 && (
              <div className="select-all-container">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                />
                <label htmlFor="select-all">Select All on Page</label>
              </div>
            )}
            {loading && <p className="placeholder">Loading conversations...</p>}
            {!loading && currentConversations.length === 0 && <p className="placeholder">No conversations yet.</p>}
            {!loading && currentConversations.map(conv => (
              <div 
                key={conv.otherUser.id} 
                className="message-item conversation-item" 
                onClick={() => !selectionMode && navigate(`/messages/chat/${conv.otherUser.id}`)}
              >
                {selectionMode && (
                  <input
                    type="checkbox"
                    className="conversation-checkbox"
                    checked={selectedConversations.has(conv.otherUser.id)}
                    onChange={() => toggleSelection(conv.otherUser.id)}
                  />
                )}
                <img 
                  src={conv.otherUser?.profile_picture || defaultProfile} 
                  alt={`${conv.otherUser?.first_name || 'User'}'s avatar`}
                  className="message-avatar"
                  onError={(e) => { e.target.onerror = null; e.target.src = defaultProfile; }}
                />
                <div className="message-details">
                  <p><strong>{conv.otherUser?.first_name || 'Unknown'} {conv.otherUser?.last_name || 'User'}</strong>
                  {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
                  </p>
                  {conv.latestMessage && conv.latestMessage.id ? (
                    <div className="message-summary">
                      <p className={`message-content-snippet ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                        {(() => {
                          const isSender = conv.latestMessage.sender_id === user.id;
                          const prefix = isSender ? "You: " : "";
                          const content = conv.latestMessage.file_url
                            ? `📄 ${conv.latestMessage.file_name || 'File'}`
                            : conv.latestMessage.content;
                          return `${prefix}${content}`;
                        })()}
                      </p>
                      <p className="message-timestamp">{
                        (() => {
                          const timestamp = conv.latestMessage.created_at;
                          if (!timestamp) return "";
                      
                          const utcDate = new Date(timestamp);
                          if (isNaN(utcDate.getTime())) return "";
                      
                          const timeZone = "Asia/Manila";
                          const nowInPH = new Date(new Date().toLocaleString("en-US", { timeZone }));
                          const yesterdayInPH = new Date(nowInPH);
                          yesterdayInPH.setDate(yesterdayInPH.getDate() - 1);
                      
                          const datePartFormatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
                          const messageDateString = datePartFormatter.format(utcDate);
                          const todayDateString = datePartFormatter.format(nowInPH);
                          const yesterdayDateString = datePartFormatter.format(yesterdayInPH);
                      
                          if (messageDateString === todayDateString) {
                            return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12: true }).format(utcDate);
                          } else if (messageDateString === yesterdayDateString) {
                            return "Yesterday";
                          } else if (utcDate.getFullYear() === nowInPH.getFullYear()) {
                            return new Intl.DateTimeFormat("en-US", { timeZone, month: "short", day: "numeric" }).format(utcDate);
                          } else {
                            return new Intl.DateTimeFormat("en-US", { timeZone, year: "2-digit", month: "numeric", day: "numeric" }).format(utcDate);
                          }
                        })()
                      }</p>
                    </div>
                  ) : (
                    <p className="message-content-snippet">No messages yet</p>
                  )}
                </div>
              </div>
            ))}
             {/* <p className="message-timestamp">{
  (() => {
    const timestamp = conv.latestMessage.created_at;
    if (!timestamp) return "";

    // Normalize Supabase timestamp → strip microseconds to 3 digits
    const safeTimestamp = timestamp.replace(
      /\.(\d{3})\d*([+-]\d{2}:\d{2})$/,
      ".$1$2"
    );

    const utcDate = new Date(conv.latestMessage.created_at);

    if (isNaN(utcDate.getTime())) {
      console.warn("Invalid date after normalization:", safeTimestamp);
      return "";
    }

    const timeZone = "Asia/Manila";

    const datePartFormatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const nowInPH = new Date(new Date().toLocaleString("en-US", { timeZone }));
    const yesterdayInPH = new Date(nowInPH);
    yesterdayInPH.setDate(yesterdayInPH.getDate() - 1);

    const messageDateString = datePartFormatter.format(utcDate);
    const todayDateString = datePartFormatter.format(nowInPH);
    const yesterdayDateString = datePartFormatter.format(yesterdayInPH);

    if (messageDateString === todayDateString) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(utcDate);
    } else if (messageDateString === yesterdayDateString) {
      return "Yesterday";
    } else if (utcDate.getFullYear() === nowInPH.getFullYear()) {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        month: "short",
        day: "numeric",
      }).format(utcDate);
    } else {
      return new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "2-digit",
        month: "numeric",
        day: "numeric",
      }).format(utcDate);
    }
  })()
}</p> */}
          </div>
        )}

        {activeTab === 'new' && (
          <div className="tab-content fadeIn">
            <h3 className="subheading">New Message</h3>
            <form className="message-form" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
              <label>
                To:
                <div className="recipient-search-container">
                  <input
                    type="text"
                    placeholder="Search by Name, Email, or School ID"
                    value={selectedRecipientUser ? recipientIdentifier : recipientSearchQuery}
                    onChange={(e) => {
                      if (selectedRecipientUser) { 
                        return;
                      }
                      setRecipientSearchQuery(e.target.value);
                      setRecipientIdentifier(e.target.value); 
                    }}
                    disabled={!!selectedRecipientUser} 
                  />
                  {selectedRecipientUser && (
                    <button type="button" onClick={() => {
                      setSelectedRecipientUser(null);
                      setRecipientIdentifier('');
                      setRecipientSearchQuery('');
                    }} className="clear-recipient-btn">Clear</button>
                  )}
                  {recipientSuggestions.length > 0 && !selectedRecipientUser && (
                    <ul className="recipient-suggestions">
                      {recipientSuggestions.map(sugg => (
                        <li key={sugg.id} onClick={() => handleRecipientSelect(sugg)}>
                          <img src={sugg.profile_picture || defaultProfile} alt="avatar" className="suggestion-avatar" />
                          {sugg.first_name} {sugg.last_name} ({sugg.school_id || sugg.email})
                        </li>
                      ))}
                    </ul>
                  )}
                  {searchError && <p className="search-error-message">{searchError}</p>}
                </div>
              </label>

              <label>
                Message:
                <textarea
                  rows="6"
                  placeholder="Write your message..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                ></textarea>
              </label>

              <div className="message-controls">
                <button type="submit" className="send-btn" disabled={loading}>{loading ? 'Sending...' : 'Send'}</button>
                <button className="cancel-btn" onClick={() => {
                  setSelectedRecipientUser(null);
                  setRecipientIdentifier('');
                  setRecipientSearchQuery('');
                  setMessageBody('');
                  setActiveTab('inbox');
                  setError('');
                }}>Cancel</button>
              </div>
            </form>
          </div>
        )}
      </div>

      {activeTab !== "new" && totalPages > 0 && (
        <div className="dashboard-footer">
          <div className="pagination">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button className="active">{currentPage}</button>
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Message;