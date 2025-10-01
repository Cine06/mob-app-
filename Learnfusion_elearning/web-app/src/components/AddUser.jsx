import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import Swal from 'sweetalert2';
import "../styles/AddUser.css";
import AdminSidebar from "./AdminSidebar";
import bcrypt from "bcryptjs";

const AddUser = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [parsedUsers, setParsedUsers] = useState([]);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);
  const [formData, setFormData] = useState({
    schoolId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    email: "",
    contact_number: "",
    password: "",
    role: "",
    section: "",
  });

  const [sections, setSections] = useState([]); 

  useEffect(() => {
    const fetchSections = async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, section_name");

      if (error) {
        console.error("Error fetching sections:", error.message);
      } else {
        setSections(data);
      }
    };

    fetchSections();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    if (formData.role === "Student") {
      const { data: existingStudent, error: studentCheckError } = await supabase
        .from("users")
        .select("section_id")
        .eq("school_id", formData.schoolId)
        .single();

      if (studentCheckError && studentCheckError.code !== 'PGRST116') { 
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error checking student status: ${studentCheckError.message}`
        });
        return;
      }

      if (existingStudent && existingStudent.section_id !== null) {
        Swal.fire({
          icon: 'warning',
          title: 'Cannot Add Student',
          text: "This student is already assigned to a section and cannot be added again."
        });
        return;
      }
    }

    try {
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("school_id, email, contact_number")
        .or(`school_id.eq.${formData.schoolId},email.eq.${formData.email},contact_number.eq.${formData.contact_number}`);

      if (checkError) {
        throw checkError;
      }

      if (existingUser && existingUser.length > 0) {
        const conflictingFields = [];
        if (existingUser.some(u => u.school_id === formData.schoolId)) conflictingFields.push("School ID");
        if (existingUser.some(u => u.email === formData.email)) conflictingFields.push("Email");
        if (existingUser.some(u => u.contact_number === formData.contact_number)) conflictingFields.push("Contact Number");
        
        Swal.fire({
          icon: 'error',
          title: 'Failed to Add User',
          text: `The following field(s) are already in use: ${conflictingFields.join(', ')}.`
        });
        return;
      }


      const hashedPassword = await bcrypt.hash(formData.password, 10);
  
      let sectionId = null;
      if (formData.role === "Student" && formData.section) {
        const selectedSection = sections.find(section => section.id === formData.section);
        if (selectedSection) {
          sectionId = selectedSection.id;
        } else {
          throw new Error("Section not found");
        }
      }
  
      const { data, error } = await supabase.from("users").insert([
        {
          school_id: formData.schoolId,
          first_name: formData.firstName,
          middle_name: formData.middleName,
          last_name: formData.lastName,
          email: formData.email,
          contact_number: formData.contact_number,
          password: hashedPassword,
          role: formData.role,
          section_id: sectionId,
        },
      ]);
  
      if (error) {
        throw error;
      }
  
      Swal.fire({
        icon: 'success',
        title: 'Success',
        text: 'User added successfully!'
      });
      setFormData({
        schoolId: "",
        firstName: "",
        middleName: "",
        lastName: "",
        email: "",
        contact_number: "",
        password: "",
        role: "",
        section: "",
      });
    } catch (error) {
      console.error("Error adding user:", error.message);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add user. Please try again.'
      });
    }
  };
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid File Type',
        text: 'Please upload a valid CSV file.'
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split(/\r\n|\n/).filter(row => row.trim() !== '');

      if (rows.length <= 1) {
        Swal.fire({
          icon: 'warning',
          title: 'Empty CSV',
          text: 'CSV file is empty or contains only a header.'
        });
        return;
      }

      const header = rows[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ["school_id", "email", "first_name", "last_name", "role"];
      const missingHeaders = requiredHeaders.filter(h => !header.includes(h));

      if (missingHeaders.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Missing Columns',
          text: `CSV header is missing required columns: ${missingHeaders.join(', ')}.`
        });
        return;
      }

      const schoolIdIndex = header.indexOf("school_id");
      const emailIndex = header.indexOf("email");
      const firstNameIndex = header.indexOf("first_name");
      const middleNameIndex = header.indexOf("middle_name");
      const lastNameIndex = header.indexOf("last_name");
      const contactNumberIndex = header.indexOf("contact_number");
      const roleIndex = header.indexOf("role");
      const sectionNameIndex = header.indexOf("section_name");

      const { data: sectionsData, error: sectionsError } = await supabase.from('sections').select('id, section_name');
      if (sectionsError) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Could not fetch sections to validate student assignments.'
        });
        return;
      }
      const sectionMap = new Map(sectionsData.map(s => [s.section_name.toLowerCase(), s.id]));
      const usersToPreview = [];
      for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(',').map(v => v.trim());
        
        const school_id = values[schoolIdIndex];
        const email = values[emailIndex];
        const first_name = values[firstNameIndex];
        const last_name = values[lastNameIndex];
        let role = values[roleIndex];

        if (!school_id || !email || !first_name || !last_name || !role) {
          console.warn(`Skipping row ${i + 1} due to missing required fields.`);
          continue;
        }

        const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
        const validRoles = ['Admin', 'Teacher', 'Student'];
        if (!validRoles.includes(normalizedRole)) {
          console.warn(`Skipping row ${i + 1} due to invalid role: "${role}". Role must be one of: ${validRoles.join(', ')}.`);
          continue;
        }
        role = normalizedRole;

        let section_name_display = "N/A";
        let section_id = null;
        if (role.toLowerCase() === 'student') {
          const section_name = sectionNameIndex > -1 ? values[sectionNameIndex] : null;
          if (section_name && sectionMap.has(section_name.toLowerCase())) {
            section_id = sectionMap.get(section_name.toLowerCase());
            section_name_display = section_name;
          } else if (section_name) {
            console.warn(`Section "${section_name}" for student ${first_name} ${last_name} not found. Assigning without section.`);
          }
        }

        usersToPreview.push({
          school_id,
          email,
          first_name: first_name,
          middle_name: middleNameIndex > -1 ? values[middleNameIndex] : null,
          last_name: last_name,
          contact_number: contactNumberIndex > -1 ? values[contactNumberIndex] : null,
          role,
          section_id,
          section_name: section_name_display,
          status: "Active",
        });
      }

      if (usersToPreview.length === 0) {
        Swal.fire({
          icon: 'info',
          title: 'No Data',
          text: 'No valid user data found in the CSV to process.'
        });
        return;
      }

      const seen = { school_ids: new Set(), emails: new Set(), contact_numbers: new Set() };
      const duplicatesInCsv = [];
      for (const user of usersToPreview) {
        if (user.school_id && seen.school_ids.has(user.school_id)) duplicatesInCsv.push(`School ID ${user.school_id}`);
        seen.school_ids.add(user.school_id);
        if (user.email && seen.emails.has(user.email)) duplicatesInCsv.push(`Email ${user.email}`);
        seen.emails.add(user.email);
        if (user.contact_number && seen.contact_numbers.has(user.contact_number)) duplicatesInCsv.push(`Contact ${user.contact_number}`);
        seen.contact_numbers.add(user.contact_number);
      }

      if (duplicatesInCsv.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Duplicate Values in CSV',
          html: `Please correct the following duplicates in your CSV file and try again:<br/>- ${duplicatesInCsv.join('<br/>- ')}`
        });
        return;
      }

      const { data: existingUsers, error: dbCheckError } = await supabase
        .from('users')
        .select('school_id, email, contact_number')
        .or(`school_id.in.(${Array.from(seen.school_ids).join(',')}),email.in.(${Array.from(seen.emails).map(e => `"${e}"`).join(',')}),contact_number.in.(${Array.from(seen.contact_numbers).map(c => `"${c}"`).join(',')})`);

      if (dbCheckError) {
        Swal.fire({
          icon: 'error',
          title: 'Database Check Error',
          text: `Error checking for existing users: ${dbCheckError.message}`
        });
        return;
      }

      if (existingUsers.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Data Conflict',
          text: 'One or more users in the CSV conflict with existing records in the database (School ID, Email, or Contact Number). Please review your file.'
        });
        return;
      }

      setParsedUsers(usersToPreview);
      setIsConfirmModalOpen(true);
    };

    reader.onerror = () => {
      Swal.fire({
        icon: 'error',
        title: 'File Read Error',
        text: 'Failed to read the CSV file.'
      });
    };

    reader.readAsText(file);
    if (event.target) {
      event.target.value = null;
    }
  };

  const handleConfirmCsvUpload = async () => {
    if (parsedUsers.length === 0) return;

    setIsProcessingCsv(true);
    try {
      const defaultPassword = "password123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const usersToInsert = parsedUsers.map(user => {
        const { section_name, ...dbUser } = user;
        return {
          ...dbUser,
          password: hashedPassword,
        };
      });
      
      const { error: insertError } = await supabase.from("users").insert(usersToInsert);

      if (insertError) throw insertError;

      Swal.fire({
        icon: 'success',
        title: 'Users Added',
        text: `${usersToInsert.length} user(s) added successfully! New users have a default password: "${defaultPassword}"`
      });
      setIsConfirmModalOpen(false);
      setParsedUsers([]);
      navigate('/admin-dashboard');

    } catch (error) {
      console.error("Error confirming CSV upload:", error);
      Swal.fire({
        icon: 'error',
        title: 'CSV Upload Error',
        text: `Error adding users via CSV: ${error.message}. Please check data for duplicates or errors.`
      });
    } finally {
      setIsProcessingCsv(false);
    }
  };
  const handleCancelCsvUpload = () => {
    setIsConfirmModalOpen(false);
    setParsedUsers([]);
  };

  const handleDownloadTemplate = () => {
    const csvHeader = "school_id,first_name,middle_name,last_name,email,contact_number,role,section_name";
    const csvContent = "data:text/csv;charset=utf-8," + csvHeader;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "csv_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <div className="form-container">
        <form onSubmit={handleSubmit} className="add-user-form">
          <h2 className="form-title">Creating New Account</h2>

          <label>Role:</label>
          <select name="role" value={formData.role} onChange={handleChange} required>
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
          </select>

          <label>School ID:</label>
          <input type="text" name="schoolId" value={formData.schoolId} onChange={handleChange} required />

          <label>Firstname:</label>
          <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />

          <label>Middlename:</label>
          <input type="text" name="middleName" value={formData.middleName} onChange={handleChange} />

          <label>Lastname:</label>
          <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />

          {formData.role === "Student" && (
            <>
              <label>Section:</label>
              <select name="section" value={formData.section} onChange={handleChange} required>
                <option value="">Select Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.section_name}
                  </option>
                ))}
              </select>
            </>
          )}

          <label>Email:</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required />

          <label>Contact number:</label>
          <input type="text" name="contact_number" value={formData.contact_number} onChange={handleChange} required />

          <label>Password:</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange} required />

          <div className="form-actions">
            <button type="submit" className="action-btn add-manual-btn">Add User</button>
            <input
              type="file"
              id="csvUpload"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".csv"
              onChange={handleFileUpload}
            />
            <button type="button" className="action-btn add-csv-btn" onClick={() => fileInputRef.current.click()}>
              Add via CSV
            </button>
          </div>
          <div className="csv-template-link">
            <button type="button" onClick={handleDownloadTemplate} className="link-style-btn">
              Download CSV template
            </button>
          </div>

        </form>

        {isConfirmModalOpen && (
          <div className="au-overlay">
            <div className="au-modal">
              <div className="au-modal-header">
                <h2>Confirm CSV Upload</h2>
                <p>Review the {parsedUsers.length} user(s) to be added. Click "Confirm" to proceed.</p>
              </div>
              <div className="au-modal-body">
                <div className="au-table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>School ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Section</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedUsers.map((user, index) => (
                        <tr key={index}>
                          <td>{user.school_id}</td>
                          <td>{`${user.first_name} ${user.last_name}`}</td>
                          <td>{user.email}</td>
                          <td>{user.role}</td>
                          <td>{user.role === 'Student' ? user.section_name : 'N/A'}</td>
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
                  {isProcessingCsv ? 'Processing...' : 'Confirm & Add Users'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddUser;
