import { supabase } from "./supabaseClient";

/**
 * @param {string} tableName 
 * @param {object} record
 * @param {string} [archivedByUserId] 
 * @returns {Promise<{ success: boolean, error: object|null }>}
 */
export const archiveRecord = async (tableName, record, archivedByUserId = null) => {
  if (!tableName || !record) {
    const error = { message: "Invalid arguments: tableName and record are required." };
    console.error(error.message);
    return { success: false, error };
  }

  if (tableName === "users" && record.role === "Student") {
    try {
      const studentId = record.id;

      const { data: assessmentData, error: assessmentError } = await supabase
        .from("student_assessments_take")
        .select(`
          *,
          student_assessments_answer ( * )
        `)
        .eq("users_id", studentId);

      if (assessmentError) {
        console.error(`Error fetching student's assessment data for archiving:`, assessmentError);
      }

      record.related_assessment_data = assessmentData || [];

    } catch (e) {
      console.error("Error gathering student data for archive:", e);
    }
  }

  const archiveData = {
    original_table_name: tableName,
    record_data: record,
  };

  if (archivedByUserId) {
    archiveData.archived_by = archivedByUserId;
  }

  const { error } = await supabase.from("archived_records").insert([archiveData]);

  if (error) {
    console.error(`Error archiving record from ${tableName}:`, error);
    return { success: false, error };
  }

  return { success: true, error: null };
};