import mongoose from "mongoose";

const { Schema } = mongoose;

// The AI output is validated in the service layer; here we keep the schema
// flexible (Mixed) for nested structures so a slightly different shape
// never crashes a save, while still indexing the fields we query on.
const StudyPackageSchema = new Schema(
  {
    metadata: {
      video_title: { type: String, required: true, index: true },
      subject: { type: String, index: true },
      estimated_level: String,
      estimated_duration_minutes: Number,
      content_type: String,
      language_detected: String,
      transcript_quality: String,
      short_description: String,
    },
    summary: { type: [Schema.Types.Mixed], default: [] },
    full_lecture_summary: String,
    core_concepts: { type: [Schema.Types.Mixed], default: [] },
    study_notes: { type: Schema.Types.Mixed, default: {} },
    comprehensive_notes: { type: [Schema.Types.Mixed], default: [] },
    quick_review: { type: Schema.Types.Mixed, default: {} },
    formula_sheet: { type: [Schema.Types.Mixed], default: [] },
    definitions: { type: [Schema.Types.Mixed], default: [] },
    exam_focus: { type: Schema.Types.Mixed, default: {} },
    quiz: { type: [Schema.Types.Mixed], default: [] },
    flashcards: { type: [Schema.Types.Mixed], default: [] },
    practice_tasks: { type: [Schema.Types.Mixed], default: [] },
    true_false_questions: { type: [Schema.Types.Mixed], default: [] },
    short_answer_questions: { type: [Schema.Types.Mixed], default: [] },
    glossary: { type: [Schema.Types.Mixed], default: [] },
    learning_objectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    recommended_next_steps: { type: [String], default: [] },
    chatbot_context: { type: Schema.Types.Mixed, default: {} },
    chat_history: { type: [Schema.Types.Mixed], default: [] },
    source: {
      type: { type: String, enum: ["transcript", "youtube", "pdf", "docx"], default: "transcript" },
      url: String,
      thumbnail: String,
      channel: String,
      duration_seconds: Number,
      filename: String,
    },
    raw_transcript: { type: String, select: false }, // kept for regeneration, not sent to client by default
  },
  { timestamps: true }
);

export default mongoose.model("StudyPackage", StudyPackageSchema);
