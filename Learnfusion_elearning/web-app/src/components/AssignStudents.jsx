import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../utils/supabaseClient";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/assignStudents.css";
import Swal from 'sweetalert2';
import "sweetalert2/dist/sweetalert2.min.css";
import Sidebar from './Sidebar';

const ITEMS_PER_PAGE = 8;

const AssignStudents = () => {
  const navigate = useNavigate();
  const { sectionName } = useParams();
  const [sectionId, setSectionId] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [parsedUsers, setParsedUsers] = useState([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchUnassignedStudents();

    const fetchSectionId = async () => {
      const { data: section } = await supabase
        .from("sections")
        .select("id")
        .eq("section_name", sectionName)
        .single();
      if (section) {
        setSectionId(section.id);
      }
    };

    fetchSectionId();
  }, []);

  const fetchUnassignedStudents = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, middle_name, last_name, school_id")
      .is("section_id", null)
      .eq("role", "Student");

    if (error) {
      console.error("Error fetching students:", error);
    } else {
      setStudents(data);
      setTotalPages(Math.ceil(data.length / ITEMS_PER_PAGE));
      setCurrentPage(1); 
    }
  };

  const handleCheckboxChange = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssign = async () => {
    if (selectedStudents.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No Students Selected",
        text: "Please select at least one student.",
      });
      return;
    }

    const updates = selectedStudents.map((id) =>
      supabase.from("users").update({ section_id: sectionId }).eq("id", id)
    );

    await Promise.all(updates);
    Swal.fire({
      icon: "success",
      title: "Success!",
      text: "Students assigned successfully!",
    });
    navigate(`/manage-section/${sectionId}`); 
  };

  const indexOfLast = currentPage * ITEMS_PER_PAGE;
  const indexOfFirst = indexOfLast - ITEMS_PER_PAGE;
  const currentStudents = students.slice(indexOfFirst, indexOfLast);

  const handleNext = () => {
    if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
  };

  const handlePrev = () => {
    if (currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "school_id,first_name,middle_name,last_name,email,contact_number";
    const csvContent = "data:text/csv;charset=utf-8," + csvHeader;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "csv_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      Swal.fire({
        icon: "warning",
        title: "Invalid File Type",
        text: "Please upload a valid CSV file.",
      });
      event.target.value = null;
      return;
    }

    const { data: sectionData, error: sectionError } = await supabase
      .from("sections")
      .select("id")
      .eq("section_name", sectionName)
      .single();

    if (sectionError || !sectionData) {
      console.error("Error fetching section:", sectionError);
      Swal.fire({
        icon: "error",
        title: "Section Not Found",
        text: "Could not find the section. Please ensure the section exists.",
      });
      event.target.value = null; 
      return;
    }
    const currentSectionId = sectionData.id;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== ''); 

      if (rows.length <= 1) {
        Swal.fire({
          icon: "warning",
          title: "Empty CSV",
          text: "CSV file is empty or contains only a header.",
        });
        return;
      }

      const parseCSVRow = (row) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        
        result.push(current.trim());
        return result;
      };

      const parseCSVRowSimple = (row) => {
        return row.split(',').map(v => v.trim());
      };

             let header = parseCSVRow(rows[0]).map(h => h.trim().toLowerCase());
       console.log('Parsed header:', header);
       console.log('Raw header row:', rows[0]);
       
       if (header.length < 5) {
         console.log('Advanced parsing failed, trying simple parsing...');
         header = parseCSVRowSimple(rows[0]).map(h => h.trim().toLowerCase());
         console.log('Simple parsed header:', header);
       }
       
        if (rows.length > 1) {
          console.log('=== FIRST DATA ROW DEBUG ===');
          console.log('Raw first data row:', rows[1]);
          console.log('Advanced parsed:', parseCSVRow(rows[1]));
          console.log('Simple parsed:', parseCSVRowSimple(rows[1]));
          console.log('=== END FIRST DATA ROW DEBUG ===');
        }
      
             const expectedHeaders = ["school_id", "email", "first_name", "last_name", "contact_number"];
       const schoolIdIndex = header.indexOf("school_id");
       const emailIndex = header.indexOf("email");
       const firstNameIndex = header.indexOf("first_name");
       const middleNameIndex = header.indexOf("middle_name"); 
       const lastNameIndex = header.indexOf("last_name");
       const contactNumberIndex = header.indexOf("contact_number");
       
       console.log('=== HEADER PARSING DEBUG ===');
       console.log('Expected headers:', expectedHeaders);
       console.log('Found headers:', header);
       console.log('Header length:', header.length);
       console.log('All indices:', {
         school_id: schoolIdIndex,
         email: emailIndex,
         first_name: firstNameIndex,
         middle_name: middleNameIndex,
         last_name: lastNameIndex,
         contact_number: contactNumberIndex
       });
       console.log('=== END HEADER PARSING DEBUG ===');

      console.log('Column indices found:', {
        school_id: schoolIdIndex,
        email: emailIndex,
        first_name: firstNameIndex,
        middle_name: middleNameIndex,
        last_name: lastNameIndex,
        contact_number: contactNumberIndex
      });

             if (schoolIdIndex === -1 || emailIndex === -1 || firstNameIndex === -1 || lastNameIndex === -1) {
         Swal.fire({
            icon: "error",
            title: "Invalid CSV Header",
            text: "CSV header is missing required columns: school_id, email, first_name, last_name. Optional: middle_name, contact_number.",
         });
         return;
       }

      const studentsToUpsert = [];
             for (let i = 1; i < rows.length; i++) {
       let values;
       if (header.length < 5) {
         values = parseCSVRowSimple(rows[i]);
       } else {
         values = parseCSVRow(rows[i]);
       }
       
       console.log(`Row ${i + 1} raw:`, rows[i]);
       console.log(`Row ${i + 1} parsed values:`, values);
       console.log(`Indices: school_id=${schoolIdIndex}, email=${emailIndex}, first_name=${firstNameIndex}, last_name=${lastNameIndex}, contact_number=${contactNumberIndex}`);
       
                         const school_id = values[schoolIdIndex];
         const email = values[emailIndex];
         const first_name = values[firstNameIndex];
         const last_name = values[lastNameIndex];
         const middle_name = middleNameIndex !== -1 ? values[middleNameIndex] : null;
         
         const contact_number = contactNumberIndex !== -1 && contactNumberIndex < values.length ? values[contactNumberIndex] : null;

         console.log(`Extracted values for row ${i + 1}:`, {
           school_id,
           email,
           first_name,
           last_name,
           middle_name,
           contact_number,
           contactNumberIndex,
           valuesLength: values.length
         });

         if (!school_id || !email || !first_name || !last_name || 
             school_id.trim() === '' || email.trim() === '' || first_name.trim() === '' || 
             last_name.trim() === '') {
           console.warn(`Skipping row ${i + 1} in CSV due to missing or empty required fields:`, {
             school_id: school_id?.trim() || 'EMPTY',
             email: email?.trim() || 'EMPTY',
             first_name: first_name?.trim() || 'EMPTY',
             last_name: last_name?.trim() || 'EMPTY'
           });
           continue; 
         }

                 studentsToUpsert.push({
           school_id,
           email,
           first_name,
           middle_name: middle_name || null,
           last_name,
           contact_number,
           password: "$2b$10$zI1G9nfk8DeLGq.2PqqMw.YFsS7.GdrFenznvvGIuQvzrxcblBwRy",
           role: "Student", 
           status: "Active", 
           section_id: currentSectionId,
         });
      }

      if (studentsToUpsert.length === 0) {
        Swal.fire({
            icon: "warning",
            title: "No Valid Data",
            text: "No valid student data found in the CSV to process.",
        });
        return;
      }

       const invalidStudents = studentsToUpsert.filter(student => 
         !student.school_id || !student.email || !student.first_name || 
         !student.last_name ||
         student.school_id.trim() === '' || student.email.trim() === '' || 
         student.first_name.trim() === '' || student.last_name.trim() === ''
       );

      if (invalidStudents.length > 0) {
        console.error('Invalid students found:', invalidStudents);
        Swal.fire({
            icon: "error",
            title: "Invalid Student Data",
            text: `Found ${invalidStudents.length} students with missing or invalid required fields. Please check your CSV format.`,
        });
        return;
      }

      const seen = { school_ids: new Set(), emails: new Set(), contact_numbers: new Set() };
      const duplicatesInCsv = [];
      for (const user of studentsToUpsert) {
        if (user.school_id && seen.school_ids.has(user.school_id)) duplicatesInCsv.push(`School ID ${user.school_id}`);
        seen.school_ids.add(user.school_id);

        if (user.email && seen.emails.has(user.email)) duplicatesInCsv.push(`Email ${user.email}`);
        seen.emails.add(user.email);

        if (user.contact_number && user.contact_number.trim() !== '' && seen.contact_numbers.has(user.contact_number)) {
          duplicatesInCsv.push(`Contact ${user.contact_number}`);
        }
        if (user.contact_number && user.contact_number.trim() !== '') {
          seen.contact_numbers.add(user.contact_number);
        }
      }

      if (duplicatesInCsv.length > 0) {
        Swal.fire({
            icon: "error",
            title: "Duplicate Values in CSV",
            text: `The CSV file contains duplicate values that must be unique. Please correct them and try again:\n- ${[...new Set(duplicatesInCsv)].join('\n- ')}`,
        });
        return;
      }

      const schoolIds = studentsToUpsert.map(s => s.school_id).filter(id => id);
      if (schoolIds.length > 0) {
        const { data: existingUsers, error: dbCheckError } = await supabase
          .from('users')
          .select('school_id, section_id')
          .in('school_id', schoolIds);

        if (dbCheckError) {
          Swal.fire({
            icon: "error",
            title: "Database Error",
            text: `Error checking for existing users: ${dbCheckError.message}`,
          });
          return;
        }

        if (existingUsers && existingUsers.length > 0) {
          const alreadyAssigned = existingUsers.filter(u => u.section_id !== null);
          if (alreadyAssigned.length > 0) {
            const conflicts = alreadyAssigned.map(u => 
              `School ID: ${u.school_id} is already assigned to a section.`
            );
            Swal.fire({
                icon: "error",
                title: "Student Already Assigned",
                html: `Some students in the CSV are already assigned to a section and cannot be added again. Please remove them from the file:<br/><br/>- ${conflicts.join('<br/>- ')}`,
            });
            return;
          }
        }
      }


      setParsedUsers(studentsToUpsert);
      setIsConfirmModalOpen(true);
      setIsUploadModalOpen(false);
             console.log('Final students to upsert:', studentsToUpsert);

       studentsToUpsert.forEach((student, index) => {
         console.log(`Student ${index + 1} password debug:`, {
           school_id: student.school_id,
           email: student.email,
           password: student.password,
           passwordType: typeof student.password,
           passwordLength: student.password?.length,
           passwordIsNull: student.password === null,
           passwordIsUndefined: student.password === undefined
         });
       });

       const finalCheck = studentsToUpsert.every(student => {
         const isValid = student.school_id && student.email && student.first_name && 
                        student.last_name && student.password && 
                        student.role && student.status;
         
         if (!isValid) {
           console.error('Invalid student found in final check:', student);
         }
         return isValid;
       });

             if (!finalCheck) {
         Swal.fire({
            icon: "error",
            title: "Missing Required Fields",
            text: "Some students have missing required fields. Please check the console for details.",
         });
         return;
       }

       console.log('=== SUPABASE UPSERT DEBUG ===');
       console.log('Number of students to upsert:', studentsToUpsert.length);
       console.log('First student object keys:', Object.keys(studentsToUpsert[0]));
       console.log('First student password value:', studentsToUpsert[0]?.password);
       console.log('=== END SUPABASE UPSERT DEBUG ===');

    };
    reader.onerror = () => {
      Swal.fire({
        icon: "error",
        title: "File Read Error",
        text: "Failed to read the CSV file.",
      });
    };
    reader.readAsText(file);
    event.target.value = null; 
  };

  const handleConfirmCsvUpload = async () => {
    if (parsedUsers.length === 0) return;

    setIsProcessingCsv(true);
    try {
      const { error: upsertError } = await supabase.from("users").upsert(parsedUsers, { onConflict: 'school_id' });

      if (upsertError) throw upsertError;

      Swal.fire({
        icon: "success",
        title: "Upload Successful!",
        text: `${parsedUsers.length} student(s) processed from CSV and assigned to section ${sectionName}!`,
      }).then(() => {
        setIsConfirmModalOpen(false);
        setParsedUsers([]);
        fetchUnassignedStudents(); 
        navigate(`/manage-section/${sectionId}`); 
      });

    } catch (error) {
      console.error("Error confirming CSV upload:", error);
      Swal.fire({
        icon: "error",
        title: "Upload Failed",
        text: `Error assigning students via CSV: ${error.message}. Please check your CSV data.`,
      });
    } finally {
      setIsProcessingCsv(false);
    }
  };

  const handleCancelCsvUpload = () => {
    setIsConfirmModalOpen(false);
    setParsedUsers([]);
  };

  return (
    <div className="assign-students-container">
      <Sidebar />
      <h2 className="section-titles">
        Assign Students to Section: <span className="highlight">{sectionName}</span>
      </h2>

      <div className="table-containerr">
        <table className="animated-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>School ID</th>
              <th>First Name</th>
              <th>Middle Name</th>
              <th>Last Name</th>
            </tr>
          </thead>
          <tbody>
            {currentStudents.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: "1rem" }}>
                  No available students to assign.
                </td>
              </tr>
            ) : (
              currentStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <input
                      type="checkbox"
                      onChange={() => handleCheckboxChange(student.id)}
                      checked={selectedStudents.includes(student.id)}
                    />
                  </td>
                  <td>{student.school_id}</td>
                  <td>{student.first_name}</td>
                  <td>{student.middle_name || "N/A"}</td>
                  <td>{student.last_name}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {students.length > 0 && (

        <div className="assign-pagination">
          <button onClick={handlePrev} disabled={currentPage === 1}>Prev</button>
          {Array.from({ length: totalPages }, (_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index + 1)}
              className={currentPage === index + 1 ? "active" : ""}
            >
              {index + 1}
            </button>
          ))}
          <button onClick={handleNext} disabled={currentPage === totalPages}>Next</button>
        </div>
      )}

      <div className="assign-controls">
        <input
          type="file"
          id="csvUpload"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept=".csv"
          onChange={handleFileUpload}
        />
        <button
          type="button"
          onClick={() => setIsUploadModalOpen(true)}
          className="upload-csv-btn"
        >
          Upload CSV & Assign
        </button>
        <button className="assign-btn" onClick={handleAssign}>Assign Selected Manually</button>
        <button className="cancel-btn" onClick={() => sectionId && navigate(`/manage-section/${sectionId}`)}>
          Back
        </button>
      </div>

      {isUploadModalOpen && (
        <div className="au-overlay">
          <div className="au-modal" style={{ maxWidth: '500px' }}>
            <div className="au-modal-header">
              <h2>Upload CSV</h2>
              <p>Upload a CSV file to bulk assign students to this section.</p>
            </div>
            <div className="au-modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '2rem' }}>
              <p>First, download the template to ensure your data is in the correct format.</p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="download-template-btn"
              >
                Download Template
              </button>
              <p>Once your file is ready, upload it here.</p>
              <button
                type="button"
                onClick={() => fileInputRef.current.click()}
                className="upload-csv-btn"
              >
                Upload File
              </button>
            </div>
            <div className="au-modal-footer">
              <button className="action-btn cancel-csv-btn" onClick={() => setIsUploadModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {isConfirmModalOpen && (
        <div className="au-overlay">
          <div className="au-modal">
            <div className="au-modal-header">
              <h2>Confirm CSV Upload for Section: {sectionName}</h2>
              <p>Review the {parsedUsers.length} student(s) to be added and assigned. Click "Confirm" to proceed.</p>
            </div>
            <div className="au-modal-body">
              <div className="au-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>School ID</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Contact Number</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedUsers.map((user, index) => (
                      <tr key={index}>
                        <td>{user.school_id}</td>
                        <td>{`${user.first_name} ${user.last_name}`}</td>
                        <td>{user.email}</td>
                        <td>{user.contact_number || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="au-modal-footer">
              <button className="action-btn cancel-csv-btn" onClick={handleCancelCsvUpload} disabled={isProcessingCsv}>
                Cancel
              </button>
              <button className="action-btn confirm-csv-btn" onClick={handleConfirmCsvUpload} disabled={isProcessingCsv}>
                {isProcessingCsv ? 'Processing...' : 'Confirm & Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignStudents;
