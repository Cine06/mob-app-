import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import defaultProfile from '/public/default_profile.png';
import '../styles/detailedChatView.css';

const DetailedChatView = () => {
  const { otherUserId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [fetchMessagesError, setFetchMessagesError] = useState(null);
  const [otherUserDetails, setOtherUserDetails] = useState(null);
  const [otherUserError, setOtherUserError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendMessageError, setSendMessageError] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadError, setFileUploadError] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState(null); 
  const [loadingMessages, setLoadingMessages] = useState(true);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null); 

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchOtherUserDetails = useCallback(async () => {
    if (!otherUserId) return;
    setOtherUserError(null);
    setOtherUserDetails(null);

    const { data, error } = await supabase
      .from('users')
      .select('id, first_name, last_name, profile_picture')
      .eq('id', otherUserId)
      .single();

    if (error) {
      console.error('Error fetching other user details:', error);
      setOtherUserError('Failed to load user details. User may not exist.');
    } else if (!data) {
      console.error('Other user not found:', otherUserId);
      setOtherUserError('Chat partner not found.');
    } else {
      setOtherUserDetails(data);
    }
  }, [otherUserId]);

  const markMessagesAsRead = useCallback(async () => {
    if (!user || !otherUserId) return;
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('receiver_id', user.id)
        .eq('sender_id', otherUserId)
        .eq('read', false);

      if (error) console.error('Error marking messages as read:', error);
    } catch (err) {
      console.error('Exception marking messages as read:', err);
    }
  }, [user, otherUserId]);

  const fetchMessages = useCallback(async () => {
    if (!user || !otherUserId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }
    setLoadingMessages(true);
    setFetchMessagesError(null);
    const { data, error } = await supabase
      .from('messages') 
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      setFetchMessagesError(error.message || 'Failed to fetch messages.');
      setMessages(data || []);
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
    if (!loadingMessages) {
      scrollToBottom();
    }
  }, [messages, loadingMessages]); 

  useEffect(() => {
    if (!user || !otherUserId || !otherUserDetails || otherUserError) return;

    const ids = [user.id, otherUserId].sort();
    const canonicalChannelName = `chat:${ids[0]}:${ids[1]}`;

    const channel = supabase
      .channel(canonicalChannelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMessagePayload = payload.new;
        if (
          (newMessagePayload.sender_id === user.id && newMessagePayload.receiver_id === otherUserId) ||
          (newMessagePayload.sender_id === otherUserId && newMessagePayload.receiver_id === user.id)
        ) { 
         setMessages(prevMessages => {
            const messageExists = prevMessages.some(msg => msg.id === newMessagePayload.id && !msg.isOptimistic);
            if (messageExists) {
              return prevMessages;
            }
            return [...prevMessages, newMessagePayload];
          });
          if (newMessagePayload.receiver_id === user.id && newMessagePayload.sender_id === otherUserId) markMessagesAsRead();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, otherUserId, otherUserDetails, otherUserError, markMessagesAsRead]);

  const handleFileIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event) => {
    const file = event.target.files?.[0];
    if (event.target) {
      event.target.value = null;
    }
    if (!file) {
      return;
    }

    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = /\.(pdf|doc|docx)$/i;
    const maxFileSize = 250 * 1024 * 1024; 

    if (!allowedExtensions.test(file.name)) {
      setFileUploadError('Invalid file type. Only PDF and DOC/DOCX files are allowed.');
      return;
    }

    if (file.size > maxFileSize) {
      setFileUploadError('File is too large. Maximum size is 250 MB.');
      return;
    }

    setSelectedFileForUpload(file);
    setFileUploadError(null); 
    setSendMessageError(null);
    setSelectedFilePreview(null); 
  };

  const clearSelectedFile = () => {
    setSelectedFileForUpload(null);
    setSelectedFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleSendMessage = async e => {
    e.preventDefault();
    if (!user || !otherUserId) return;

    if (selectedFileForUpload) {
      setIsUploadingFile(true);
      setFileUploadError(null);
      setSendMessageError(null);

      const file = selectedFileForUpload;
      const caption = newMessage.trim();

      const tempId = crypto.randomUUID();
      const optimisticMessage = {
        id: tempId,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: caption || `Uploading ${file.name}...`,
        created_at: new Date().toISOString(),
        read: false,
        isOptimistic: true,
        file_name: file.name,
        file_url: selectedFilePreview, 
      };
      setMessages(prev => [...prev, optimisticMessage]);

      try {
        const BUCKET_NAME = 'message-attachments';
        const uniqueFileName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const filePath = `public/${uniqueFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(filePath, file);

        if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

        const { data: urlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        if (!urlData || !urlData.publicUrl) throw new Error('Could not retrieve public URL for the file.');
        
        const publicURL = urlData.publicUrl;
        const messageContent = caption || `File: ${file.name}`;

        const { data: dbMessage, error: messageError } = await supabase
          .from('messages')
          .insert([{
            sender_id: user.id,
            receiver_id: otherUserId,
            content: messageContent,
            file_url: publicURL,
            file_name: file.name,
          }])
          .select()
          .single();

        if (messageError) throw messageError;

        if (dbMessage) {
          setMessages(prev => prev.map(msg => (msg.id === tempId ? dbMessage : msg)));
        } else {
          console.warn('File uploaded and DB insert attempted, but no message data returned.');
          setFileUploadError('Failed to finalize file message. Please try again.');
        }
        clearSelectedFile();
        setNewMessage('');
      } catch (error) {
        console.error('Error sending file:', error);
        setFileUploadError(`Failed to send file: ${error.message}`);
        setMessages(prev => prev.filter(msg => msg.id !== tempId)); 
      } finally {
        setIsUploadingFile(false);
      }
    } else if (newMessage.trim()) {
      setSendingMessage(true);
      setSendMessageError(null);
      setFileUploadError(null);

      const tempId = crypto.randomUUID();
      const optimisticMessage = {
        id: tempId,
        sender_id: user.id,
        receiver_id: otherUserId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        read: false,
        isOptimistic: true,
      };
      
      setMessages(prevMessages => [...prevMessages, optimisticMessage]);
      const messageToSend = newMessage.trim();
      setNewMessage('');

      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: otherUserId,
          content: messageToSend,
        }])
        .select()
        .single();

      setSendingMessage(false);

      if (error) {
        console.error('Error sending message:', error);
        setSendMessageError('Failed to send message. Please try again.');
        setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticMessage.id));
      } else if (data) {
        setMessages(prevMessages => prevMessages.map(msg => (msg.id === optimisticMessage.id ? data : msg)));
      }
    }
  };

  const handleFileInputChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    handleFileSelected(event);
  };

  if (otherUserError) {
    return (
      <div className="detailed-chat-container">
        <Sidebar />
        <main className="detailed-chat-main">
          <header className="detailed-chat-header">
            <button onClick={() => navigate('/messages')} className="back-button">
              Back
            </button>
            <h2>Chat Error</h2>
          </header>
          <div className="messages-area error-message">{otherUserError}</div>
        </main>
      </div>
    );
  }

  if (!otherUserDetails) return <div className="loading-chat">Loading chat...</div>;

  return (
    
    <div className="detailed-chat-container">
      <Sidebar />
      <main className="detailed-chat-main">
        <header className="detailed-chat-header">
          <button onClick={() => navigate('/messages')} className="back-button">
            Back
          </button>
          <img
            src={otherUserDetails.profile_picture || defaultProfile}
            alt={otherUserDetails.first_name || 'User'}
            className="chat-header-avatar"
            onError={e => {
              e.target.onerror = null;
              e.target.src = defaultProfile;
            }}
          />
          <h2>
            {otherUserDetails.first_name} {otherUserDetails.last_name}
          </h2>
        </header>

        <div className="messages-area" ref={messagesContainerRef}>
          {loadingMessages && messages.length === 0 && <p className="info-message">Loading messages...</p>}
          {!loadingMessages && fetchMessagesError && <p className="error-message">Error: {fetchMessagesError}</p>}
          {!loadingMessages && !fetchMessagesError && messages.length === 0 && (
            <p className="info-message">No messages yet. Start the conversation!</p>
          )}
        {!fetchMessagesError && messages.map(msg => {
            const isFileMessage = msg.file_url && msg.file_name;
            const isImageFile = msg.file_name && /\.(jpeg|jpg|gif|png|webp)$/i.test(msg.file_name);
            const caption = msg.content; 

            return (
              <div key={msg.id} className={`message-bubble ${msg.sender_id === user?.id ? 'sent' : 'received'} ${msg.isOptimistic ? 'optimistic' : ''} ${isUploadingFile && msg.isOptimistic ? 'uploading' : ''}`}>
                {msg.isOptimistic && msg.file_name ? (
                  <div className="message-content optimistic-file-upload file-message-content">
                    {isImageFile && msg.file_url && <img src={msg.file_url} alt="Uploading..." className="message-image-attachment" />}
                    <p><em>{caption || `Uploading ${msg.file_name}...`}</em></p>
                  </div>
                ) : isFileMessage ? (
                  <div className="message-content file-message-content">
                    {isImageFile ? (
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                        <img src={msg.file_url} alt={msg.file_name} className="message-image-attachment" />
                        <p>{msg.file_name}</p>
                      </a>
                    ) : (
                      <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="file-attachment-link">
                        📄 {msg.content || msg.file_name || 'View Attached File'}
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="message-content">{msg.content}</p>
                )}
                <span className="message-timestamp">
                  {msg.created_at
                    ? new Date(msg.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        timeZone: 'Asia/Manila',
                        hour12: true,
                      })
                    : ''}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {sendMessageError && <p className="error-message send-error-message">{sendMessageError}</p>}
        {fileUploadError && <p className="error-message send-error-message">{fileUploadError}</p>}
        {isUploadingFile && <p className="info-message">Uploading file, please wait...</p>}

        {/* Display staged file preview */}
        {selectedFileForUpload && (
          <div className="staged-file-preview-container">
            {selectedFilePreview ? (
              <img src={selectedFilePreview} alt="Preview" className="staged-file-image-preview" />
            ) : (
              <div className="staged-file-icon">📄</div>
            )}
            <span className="staged-file-name">{selectedFileForUpload.name}</span>
            <button type="button" onClick={clearSelectedFile} className="clear-staged-file-button" aria-label="Remove selected file" disabled={isUploadingFile}>
              &times;
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="message-input-form">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none'}}
            onChange={handleFileInputChange} 
            accept=".pdf,.doc,.docx"
          />
         <button type="button" onClick={handleFileIconClick} className="attach-file-button" disabled={isUploadingFile || sendingMessage} title="Attach file" aria-label="Attach file"> 📎
          </button>
          <input 
            className="type"
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={selectedFileForUpload ? "Add a caption (optional)..." : "Type a message..."}
            disabled={sendingMessage || isUploadingFile}
          />
          <button
            type="submit"
            disabled={
              sendingMessage || 
              isUploadingFile || 
              (!newMessage.trim() && !selectedFileForUpload) 
            }
          >
            {isUploadingFile ? 'Uploading...' : sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </form>
      </main>
    </div>
  );
};

export default DetailedChatView;
