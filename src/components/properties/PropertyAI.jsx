import { useState, useEffect } from 'react';

export function PropertyAI({ 
  value, 
  onChange, 
  prompt = '', 
  context = {},
  placeholder = 'AI-generated content...',
  autoFocus = false 
}) {
  const [localValue, setLocalValue] = useState(value || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Simulate AI generation (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate based on prompt and context
      let generated = '';
      
      if (prompt.toLowerCase().includes('summary')) {
        generated = `Summary of "${context.text || 'task'}"`;
      } else if (prompt.toLowerCase().includes('priority')) {
        generated = context.date ? 'Consider high priority due to upcoming deadline' : 'Normal priority';
      } else if (prompt.toLowerCase().includes('action')) {
        generated = `Action items for: ${context.text || 'this task'}`;
      } else {
        generated = `AI response for: ${prompt || 'general query'}`;
      }

      setLocalValue(generated);
      onChange(generated);
    } catch (err) {
      setError('Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="property-ai-wrapper property-ai-editing">
        <textarea
          className="property-ai-textarea"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          placeholder={placeholder}
          rows={3}
          autoFocus
        />
        <div className="property-ai-edit-actions">
          <button className="btn btn-sm btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-sm btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="property-ai-wrapper">
      {isGenerating ? (
        <div className="property-ai-generating">
          <span className="property-ai-spinner">⏳</span>
          <span>Generating...</span>
        </div>
      ) : localValue ? (
        <div className="property-ai-content">
          <div className="property-ai-value">{localValue}</div>
          <div className="property-ai-actions">
            <button 
              className="property-ai-btn"
              onClick={() => setIsEditing(true)}
              title="Edit"
            >
              ✏️
            </button>
            <button 
              className="property-ai-btn"
              onClick={handleGenerate}
              title="Regenerate"
            >
              🔄
            </button>
            <button 
              className="property-ai-btn"
              onClick={() => { setLocalValue(''); onChange(''); }}
              title="Clear"
            >
              ×
            </button>
          </div>
        </div>
      ) : (
        <div className="property-ai-empty">
          <button 
            className="property-ai-generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <span>🤖</span>
            <span>Generate with AI</span>
          </button>
          {prompt && (
            <div className="property-ai-prompt-preview">
              Prompt: {prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt}
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="property-ai-error">{error}</div>
      )}
    </div>
  );
}
