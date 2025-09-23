import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { supabase } from '../utils/supabaseClient';
import '../styles/LessonDetails.css';

const LessonDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchLessonDetails = async () => {
      if (!id) {
        setError("Lesson ID is missing.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('lessons')
          .select('title, video_url, pdf_url') 
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;
        setLesson(data);
      } catch (err) {
        console.error('Error fetching lesson details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLessonDetails();
  }, [id]);

  const handleBack = () => {
    navigate('/handouts');
  };

  return (
    <div className="lesson-details-layout">
      <Sidebar />
      <main className="lesson-details-content">
        <button className="back-button" onClick={handleBack}>← Back to Handouts</button>

        {loading && <p className="loading-message">Loading lesson details...</p>}
        {error && <p className="loading-message" style={{ color: 'red' }}>Error: {error}</p>}
        {!loading && lesson ? (
          <div className="lesson-container">
            <h2 className="lesson-title">{lesson.title}</h2>

            {lesson.video_url && (
              <div className="video-container">
                <iframe
                  width="100%"
                  height="400"
                  src={lesson.video_url}
                  title="Lesson Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            {lesson.pdf_url && (
              <div className="pdf-container">
                <iframe
                  src={supabase.storage.from('lesson-files').getPublicUrl(lesson.pdf_url).data.publicUrl}
                  width="100%"
                  height="600px"
                  title="PDF Handout"
                ></iframe>
              </div>
            )}
            {!lesson.video_url && !lesson.pdf_url && <p>No content available for this lesson.</p>}
          </div>
        ) : (
          !loading && !error && <p className="loading-message">Lesson not found or no content available.</p>
        )}
      </main>
    </div>
  );
};

export default LessonDetails;
