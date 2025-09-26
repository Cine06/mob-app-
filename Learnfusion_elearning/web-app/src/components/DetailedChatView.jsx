import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import { FaArrowLeft, FaPaperclip, FaTimes } from 'react-icons/fa';
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import defaultProfile from "/public/default_profile.png";
import "../styles/detailedChatView.css";

const DetailedChatView = () => {
  const { otherUserId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [fetchMessagesError, setFetchMessagesError] = useState(null);
  const [otherUserDetails, setOtherUserDetails] = useState(null);
  const [otherUserError, setOtherUserError] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false); 
  
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState(null); 

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      requestAnimationFrame(() => {
        messagesEndRef.current.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
      });
    }
  };

  useLayoutEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [loadingMessages]);

  useLayoutEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages]);

  const fetchOtherUserDetails = useCallback(async () => {
    if (!otherUserId) return;

    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name, profile_picture")
      .eq("id", otherUserId)
      .single();

    if (error) {
      setOtherUserError("Failed to load user details.");
    } else {
      setOtherUserDetails(data);
    }
  }, [otherUserId]);

  const markMessagesAsRead = useCallback(async () => {
    if (!user || !otherUserId) return;
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("receiver_id", user.id)
      .eq("sender_id", otherUserId)
      .eq("read", false);
  }, [user, otherUserId]);

  const fetchMessages = useCallback(async () => {
    if (!user || !otherUserId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .in("sender_id", [user.id, otherUserId])
      .in("receiver_id", [user.id, otherUserId])
      .order("created_at", { ascending: true });

    if (error) {
      setFetchMessagesError("Failed to fetch messages.");
    } else {
      setMessages(data || []);
      markMessagesAsRead();
    }
    setLoadingMessages(false);
  }, [user, otherUserId, markMessagesAsRead]);

  useEffect(() => {
    fetchOtherUserDetails();
    fetchMessages();
  }, [fetchOtherUserDetails, fetchMessages]);

  useEffect(() => {
    if (!user || !otherUserId || !otherUserDetails || otherUserError) return;

    const ids = [user.id, otherUserId].sort();
    const channel = supabase
      .channel(`chat:${ids[0]}:${ids[1]}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMsg = payload.new;
          if ((newMsg.sender_id === user.id && newMsg.receiver_id === otherUserId) || (newMsg.sender_id === otherUserId && newMsg.receiver_id === user.id)) {
            setMessages((prev) => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (newMsg.receiver_id === user.id) markMessagesAsRead();
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const updatedMsg = payload.new;
          if (updatedMsg.receiver_id === otherUserId && updatedMsg.sender_id === user.id && updatedMsg.read) {
            fetchMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, otherUserDetails, otherUserError, markMessagesAsRead, fetchMessages]);

  const handleFileIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = null; 
    if (!file) return;

    const allowedExtensions = /\.(pdf|doc|docx)$/i;
    const maxFileSize = 25 * 1024 * 1024; 

    if (!allowedExtensions.test(file.name)) {
      setFileUploadError('Invalid file type. Allowed: PDF, DOC, DOCX.');
      return;
    }

    if (file.size > maxFileSize) {
      setFileUploadError('File is too large. Maximum size is 25 MB.');
      return;
    }

    setSelectedFileForUpload(file);
    setFileUploadError(null);

    if (file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      setSelectedFilePreview(previewUrl);
    } else {
      setSelectedFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFileForUpload(null);
    setSelectedFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user || !otherUserId) return;

    if (selectedFileForUpload) {
      setIsUploadingFile(true);
      setFileUploadError(null);
      const file = selectedFileForUpload;
      const caption = newMessage.trim();

      const tempId = crypto.randomUUID();
      const optimisticMessage = {
        id: tempId,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: caption,
        file_name: file.name,
        file_url: selectedFilePreview,
        created_at: new Date().toISOString(),
        read: false,
        isOptimistic: true,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      clearSelectedFile();
      setNewMessage('');

      try {
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(filePath);
        if (!urlData.publicUrl) throw new Error("Could not get public URL for the file.");

        const { data: dbMessage, error: insertError } = await supabase
          .from('messages')
          .insert([{
            sender_id: user.id,
            receiver_id: otherUserId,
            content: caption,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: file.type,
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        setMessages(prev => prev.map(msg => (msg.id === tempId ? dbMessage : msg)));
      } catch (err) {
        console.error('Error sending file:', err);
        setFileUploadError('Failed to send file. Please try again.');
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      } finally {
        setIsUploadingFile(false);
      }
    }
    else if (newMessage.trim()) {
      setSendingMessage(true);
      const content = newMessage.trim();
      const tempId = crypto.randomUUID();
      const optimisticMessage = {
        id: tempId,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: content,
        created_at: new Date().toISOString(),
        read: false,
        isOptimistic: true,
      };

      setMessages(prev => [...prev, optimisticMessage]);
      setNewMessage('');

      const { data, error } = await supabase
        .from('messages')
        .insert([{ sender_id: user.id, receiver_id: otherUserId, content }])
        .select().single();

      if (error) {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
      } else if (data) {
        setMessages(prev => prev.map(msg => (msg.id === tempId ? data : msg)));
      }
      setSendingMessage(false);
    }
  };

  return (
    <div className="detailed-chat-container">
      <Sidebar />
      <main className="detailed-chat-main">
        <header className="detailed-chat-header">
          <button onClick={() => navigate("/messages")} className="back-button" aria-label="Back to messages">
            <FaArrowLeft />
          </button>
          <img
            src={otherUserDetails?.profile_picture || defaultProfile}
            alt={otherUserDetails?.first_name || "User"}
            className="chat-header-avatar"
          />
          <h2>
            {otherUserDetails?.first_name} {otherUserDetails?.last_name}
          </h2>
        </header>

        <div className="messages-area">
          {messages.map((msg) => {
            const lastSentMessage = messages.filter(m => m.sender_id === user?.id).slice(-1)[0];
            const isLastSentMessage = msg.id === lastSentMessage?.id;
            const isFileMessage = msg.file_url && msg.file_name;
            const isImageFile = msg.file_name && /\.(jpeg|jpg|gif|png|webp)$/i.test(msg.file_name);

            return (
              <div
                key={msg.id}
                className={`message-bubble ${msg.sender_id === user?.id ? 'sent' : 'received'} ${msg.isOptimistic ? 'optimistic' : ''}`}
              >
                {isFileMessage ? (
                  <div className="message-content file-message-content">
                    {isImageFile && (
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.file_url} alt={msg.file_name} className="message-image-attachment" />
                      </a>
                    )}
                    {!isImageFile && (
                       <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="file-attachment-link">
                         📄 {msg.file_name}
                       </a>
                    )}
                  </div>
                ) : (
                  <p className="message-content">{msg.content}</p>
                )}
                <span className="message-timestamp">
                  {new Date(msg.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    timeZone: "Asia/Manila",
                    hour12: true,
                  })}
                </span>
                {isLastSentMessage && msg.read && (
                  <span className="read-receipt">Read</span>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {fileUploadError && <p className="error-message">{fileUploadError}</p>}

        {selectedFileForUpload && (
          <div className="staged-file-preview-container">
            {selectedFilePreview ? (
              <img src={selectedFilePreview} alt="Preview" className="staged-file-image-preview" />
            ) : (
              <div className="staged-file-icon">📄</div>
            )}
            <span className="staged-file-name">{selectedFileForUpload.name}</span>
            <button
              type="button"
              onClick={clearSelectedFile}
              className="clear-staged-file-button"
              aria-label="Remove selected file"
              disabled={isUploadingFile}
            >
              <FaTimes />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="message-input-form">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelected}
            accept=".pdf,.doc,.docx"
          />
          <button
            type="button"
            onClick={handleFileIconClick}
            className="attach-file-button"
            disabled={isUploadingFile || sendingMessage}
            title="Attach file"
          >
            <FaPaperclip />
          </button>
          <input
            className="type"
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={selectedFileForUpload ? "Add a caption..." : "Type a message..."}
            disabled={isUploadingFile}
          />
          <button type="submit" disabled={isUploadingFile || sendingMessage || (!newMessage.trim() && !selectedFileForUpload)}>
            {isUploadingFile ? 'Uploading...' : sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default DetailedChatView;
