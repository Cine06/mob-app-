import React, { useState } from 'react';
import '../styles/AssessmentPreview.css';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

function MatchingQuestionPreviewDND({ question, questionIndex }) {
  const prompts = question.matchingPairs.map((p, i) => ({
    id: `prompt-${questionIndex}-${i}`,
    content: p.left,
  }));

  const initialChoices = question.matchingPairs.map((p, i) => ({
    id: `choice-${questionIndex}-${i}-${p.right.replace(/\W/g, '')}`,
    content: p.right,
  }));

  const [choicesInPool, setChoicesInPool] = useState(() => shuffleArray([...initialChoices]));
  const [slots, setSlots] = useState(() => Array(prompts.length).fill(null));

  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    const draggedItem = choicesInPool.find(c => c.id === draggableId) || slots.find(s => s && s.id === draggableId);
    if (!draggedItem) return;

    let newChoicesInPool = [...choicesInPool];
    let newSlots = [...slots];

    if (source.droppableId === `choices-pool-${questionIndex}`) {
      newChoicesInPool = newChoicesInPool.filter(item => item.id !== draggableId);
    } else if (source.droppableId.startsWith(`prompt-slot-${questionIndex}`)) {
      const sourceSlotIndex = parseInt(source.droppableId.split('-')[3]);
      if (newSlots[sourceSlotIndex] && newSlots[sourceSlotIndex].id === draggableId) {
        newSlots[sourceSlotIndex] = null;
      }
    }

    if (destination.droppableId === `choices-pool-${questionIndex}`) {
      if (!newChoicesInPool.find(item => item.id === draggableId)) {
        newChoicesInPool.splice(destination.index, 0, draggedItem);
      }
    } else if (destination.droppableId.startsWith(`prompt-slot-${questionIndex}`)) {
      const destSlotIndex = parseInt(destination.droppableId.split('-')[3]);
      const itemCurrentlyInDestSlot = newSlots[destSlotIndex];

      if (itemCurrentlyInDestSlot) {
        if (!newChoicesInPool.find(item => item.id === itemCurrentlyInDestSlot.id)) {
          newChoicesInPool.push(itemCurrentlyInDestSlot);
        }
      }
      newSlots[destSlotIndex] = draggedItem;
    }

    setChoicesInPool(newChoicesInPool);
    setSlots(newSlots);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="dnd-container">
        <div className="dnd-prompts">
          <strong>Prompts:</strong>
          {prompts.map((prompt, promptIndex) => (
            <div key={prompt.id} className="dnd-prompt-item">
              <span className="dnd-prompt-text">{prompt.content}</span>
              <Droppable droppableId={`prompt-slot-${questionIndex}-${promptIndex}`} type="CHOICE_ITEM">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`dnd-slot ${snapshot.isDraggingOver ? 'over' : ''} ${slots[promptIndex] ? 'filled' : ''}`}
                  >
                    {slots[promptIndex] ? (
                      <Draggable draggableId={slots[promptIndex].id} index={0} type="CHOICE_ITEM">
                        {(providedDraggable, snapshotDraggable) => (
                          <div
                            ref={providedDraggable.innerRef}
                            {...providedDraggable.draggableProps}
                            {...providedDraggable.dragHandleProps}
                            className={`dnd-choice-item ${snapshotDraggable.isDragging ? 'dragging' : ''}`}
                            style={providedDraggable.draggableProps.style}
                          >
                            {slots[promptIndex].content}
                          </div>
                        )}
                      </Draggable>
                    ) : (
                      <span className="dnd-drop-placeholder">Drop here</span>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>

        <div className="dnd-choices-pool-container">
          <strong>Choices:</strong>
          <Droppable droppableId={`choices-pool-${questionIndex}`} type="CHOICE_ITEM">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`dnd-choices-pool ${snapshot.isDraggingOver ? 'over' : ''}`}
              >
                {choicesInPool.map((choice, choiceIndex) => (
                  <Draggable key={choice.id} draggableId={choice.id} index={choiceIndex} type="CHOICE_ITEM">
                    {(providedDraggable, snapshotDraggable) => (
                      <div
                        ref={providedDraggable.innerRef}
                        {...providedDraggable.draggableProps}
                        {...providedDraggable.dragHandleProps}
                        className={`dnd-choice-item ${snapshotDraggable.isDragging ? 'dragging' : ''}`}
                        style={providedDraggable.draggableProps.style}
                      >
                        {choice.content}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      </div>
    </DragDropContext>
  );
}

export default function AssessmentPreview({ task }) {

  return (
    <div className="assessment-preview-main-content">
      <h2 className="preview-title">{task.title}</h2>

      {task.description && (
        <p className="preview-description">
          {task.description}
        </p>
      )}

      {task.questions && task.questions.length > 0 ? (task.questions.map((q, idx) => (
        <div key={idx} className="preview-question-container">
          <p className="preview-question-text">
            <b>Q{idx + 1} ({q.activityType}):</b> {q.question}
          </p>

          {q.activityType === 'Multiple Choice' && (
            <div className="preview-choices-container">
              {q.choices.map((c, i) => (
                <div key={i} className={`preview-choice-item ${c === q.correctAnswer ? 'correct' : ''}`}>
                  <span className="preview-choice-indicator">
                    {c === q.correctAnswer ? '✔' : '○'}
                  </span>
                  <span className="preview-choice-text">{c}</span>
                </div>
              ))}
            </div>
          )}

          {q.activityType === 'True or False' && (
            <div className="preview-choices-container">
              {['True', 'False'].map((c, i) => (
                <div key={i} className={`preview-choice-item ${c === q.correctAnswer ? 'correct' : ''}`}>
                   <span className="preview-choice-indicator">
                    {c === q.correctAnswer ? '✔' : '○'}
                  </span>
                  <span className="preview-choice-text">{c}</span>
                </div>
              ))}
            </div>
          )}

          {q.activityType === 'Matching' && q.matchingPairs && q.matchingPairs.length > 0 && (
            <>
              <div className="preview-correct-pairs">
                <strong>Correct Pairs:</strong>
                <div className="matching-pairs-grid">
                  {q.matchingPairs.map((pair, pairIdx) => (
                    <div key={`correct-pair-${idx}-${pairIdx}`} className="matching-pair-item">{pair.left} <span className="arrow">&rarr;</span> {pair.right}</div>
                  ))}
                </div>
              </div>
              <p style={{marginTop: '15px', fontSize: '0.9em', color: '#666'}}>Below is an interactive preview of the matching question:</p>
              <div style={{ border: '1px solid #eee', padding: '15px', borderRadius: '8px', marginTop: '5px' }}>
                <MatchingQuestionPreviewDND question={q} questionIndex={idx} />
              </div>
            </>
          )}

          {q.activityType !== 'Matching' && q.activityType !== 'Multiple Choice' && q.activityType !== 'True or False' && (
            <div className="preview-answer-display">
              Correct Answer: <span className="correct-answer-badge">{q.correctAnswer}</span>
            </div>
          )}
        </div>
      ))) : (
        <div className="preview-placeholder">This assessment has no questions yet.</div>
      )}
    </div>
  );
}
