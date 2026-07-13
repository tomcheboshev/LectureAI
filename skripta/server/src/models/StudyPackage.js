import mongoose from "mongoose";

const { Schema } = mongoose;

// The AI output is validated in the service layer; here we keep the schema
// flexible (Mixed) for nested structures so a slightly different shape
// never crashes a save, while still indexing the fields we query on.
const StudyPackageSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // Generation runs asynchronously (extract -> generate -> save); the
    // frontend polls GET /:id/status while this progresses.
    status: {
      type: String,
      enum: ["queued", "extracting", "generating", "saving", "completed", "failed"],
      default: "completed", // legacy/synchronous creation paths default to already-done
      index: true,
    },
    progress: { type: Number, default: 100, min: 0, max: 100 },
    // Human-readable detail shown alongside the progress bar during
    // multi-file/chunked generation, e.g. "Summarizing lecture2.pptx (2/4)…"
    // — not set for the single-call path, which has no meaningful
    // per-document breakdown to report.
    progressDetail: String,
    generationError: String,

    metadata: {
      video_title: { type: String, default: "Generating…", index: true },
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
    quiz: { type: [Schema.Types.Mixed], default: [] },
    flashcards: { type: [Schema.Types.Mixed], default: [] },
    practice_tasks: { type: [Schema.Types.Mixed], default: [] },
    true_false_questions: { type: [Schema.Types.Mixed], default: [] },
    short_answer_questions: { type: [Schema.Types.Mixed], default: [] },
    glossary: { type: [Schema.Types.Mixed], default: [] },
    learning_objectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    recommended_next_steps: { type: [String], default: [] },
    // Auditable log of phonetic/homophone transcription errors the AI healed
    // (e.g. "vortex" -> "vertex") — keeps that correction visible instead of
    // a silent, untraceable rewrite of the source material.
    transcription_corrections: { type: [Schema.Types.Mixed], default: [] },
    chatbot_context: { type: Schema.Types.Mixed, default: {} },
    chat_history: { type: [Schema.Types.Mixed], default: [] },
    source: {
      type: {
        type: String,
        enum: ["transcript", "youtube", "pdf", "docx", "pptx", "txt", "md", "srt", "vtt", "image", "mixed"],
        default: "transcript",
      },
      url: String,
      thumbnail: String,
      channel: String,
      duration_seconds: Number,
      filename: String,
    },
    // Present when generated from one or more uploaded files (multi-file
    // upload); each entry is one source document, in upload order.
    sources: {
      type: [
        {
          filename: String,
          file_type: String,
          order: Number,
          extracted_text: { type: String, select: false },
          metadata: Schema.Types.Mixed,
        },
      ],
      default: undefined,
    },
    raw_transcript: { type: String, select: false }, // kept for regeneration, not sent to client by default
  },
  { timestamps: true }
);

export default mongoose.model("StudyPackage", StudyPackageSchema);
