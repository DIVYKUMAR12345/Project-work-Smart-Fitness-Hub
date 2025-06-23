import CONFIG from "../config.js"; // Import the configuration file

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  
  // Get form values
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  
  // Validate form
  let isValid = true;
  
  if (!email) {
    showError("email", "Please enter your email");
    isValid = false;
  }
  
  if (!password) {
    showError("password", "Please enter your password");
    isValid = false;
  }
  
  if (!isValid) return;

  try {
    // Make login request
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth_login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    if (response.ok) {
      const data = await response.json();
      // Save user data to localStorage for session management
      localStorage.setItem("user", JSON.stringify(data));
      
      // Redirect to dashboard
      window.location.href = "../dashboard/index.html";
    } else if (response.status === 401) {
      showError("password", "Invalid email or password");
    } else {
      alert("Login failed. Please try again.");
    }
  } catch (error) {
    console.error("Login error:", error);
    alert("Network error. Please check your connection.");
  }
});

// Helper function to show error messages
function showError(fieldId, message) {
  const field = document.getElementById(fieldId);
  field.classList.remove("valid");
  field.classList.add("invalid");
  
  const errorElement = field.nextElementSibling;
  errorElement.textContent = message;
  errorElement.classList.add("active");
}