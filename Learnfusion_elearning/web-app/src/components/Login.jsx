import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseClient";
import bcrypt from "bcryptjs"; 
import { useAuth } from "../context/AuthContext"; 
import "../styles/Login.css";

const Login = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth(); 

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !user) {
        throw new Error("Invalid email or password.");
      }

      if (user.status === "Inactive") {
        throw new Error("Your account has been deactivated. Please contact the administrator.");
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      if (!passwordMatch) {
        throw new Error("Invalid email or password.");
      }

      if (user.role === "Student") {
        throw new Error("Student accounts cannot log in here.");
      }

      localStorage.setItem("user", JSON.stringify(user));
      setUser(user);

      if (user.role === "Admin") {
        navigate("/admin-dashboard");
      } else if (user.role === "Teacher") {
        navigate("/teacher-dashboard");
      } else {
        throw new Error("Unauthorized role.");
      }

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <img src="/logo.png" alt="LearnFusion Logo" className="logo" />
        <h2 className="tagline">ELEVATE YOUR SKILLS WITH LEARNFUSION</h2>
      </div>

      <div className="login-right">
        <h1 className="brand-title">
          <span className="highlight">Learn</span>Fusion
        </h1>

        <form className="login-form" onSubmit={handleLogin}>
          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="button-container">
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
    </div>
  );
};

export default Login;
