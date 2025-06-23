import CONFIG from "../config.js"; // Import the configuration file

let currentStep = 1;

function showStep(step) {
  const steps = document.querySelectorAll(".form-step");
  const indicators = document.querySelectorAll(".step");

  // Hide all steps and remove active class
  steps.forEach((s) => {
    s.style.display = "none";
    s.classList.remove("active");
  });
  indicators.forEach((indicator) => indicator.classList.remove("active"));

  // Show the current step and add active class
  const currentStep = document.querySelector(`.form-step[data-step="${step}"]`);
  currentStep.style.display = "block";
  currentStep.classList.add("active");
  document.querySelector(`.step:nth-child(${step})`).classList.add("active");

  // Update buttons
  if (step === 1) {
    document.getElementById("prevBtn").style.display = "none";
  } else {
    document.getElementById("prevBtn").style.display = "inline-block";
  }

  if (step === 4) {
    document.getElementById("nextBtn").style.display = "none";
    document.getElementById("submitBtn").style.display = "inline-block";
  } else {
    document.getElementById("nextBtn").style.display = "inline-block";
    document.getElementById("submitBtn").style.display = "none";
  }
}

function validateStep() {
  const currentFormStep = document.querySelector(`.form-step.active`);
  const inputs = currentFormStep.querySelectorAll("input, select, textarea");
  let isValid = true;

  inputs.forEach((input) => {
    // Reset validation state
    input.classList.remove("invalid");
    input.classList.add("valid");
    input.nextElementSibling.classList.remove("active");
    
    // Skip validation for optional medical history
    if (input.id === "medical-history") return;
    
    // Check if field is empty (basic HTML validation)
    if (!input.checkValidity()) {
      input.classList.remove("valid");
      input.classList.add("invalid");
      input.nextElementSibling.textContent = "This field is required.";
      input.nextElementSibling.classList.add("active");
      isValid = false;
      return;
    }
    
    // Additional custom validation for specific fields
    if (input.type === "number") {
      const value = input.value.trim();
      
      // Check if input contains only numbers
      if (!/^\d+$/.test(value)) {
        input.classList.remove("valid");
        input.classList.add("invalid");
        input.nextElementSibling.textContent = "Please enter a valid number.";
        input.nextElementSibling.classList.add("active");
        isValid = false;
      }
      
      // Age-specific validation
      if (input.id === "age") {
        const age = parseInt(value, 10);
        if (age < 13) {
          input.classList.remove("valid");
          input.classList.add("invalid");
          input.nextElementSibling.textContent = "You must be at least 13 years old.";
          input.nextElementSibling.classList.add("active");
          isValid = false;
        }
      }
    }
  });
  // Password validation
  if (currentStep === 1) {
    const passwordInput = document.getElementById("password");
    const confirmPasswordInput = document.getElementById("confirm_password");
    
    if (passwordInput && confirmPasswordInput) {
      // Check password length
      if (passwordInput.value.length < 8) {
        passwordInput.classList.remove("valid");
        passwordInput.classList.add("invalid");
        passwordInput.nextElementSibling.textContent = "Password must be at least 8 characters.";
        passwordInput.nextElementSibling.classList.add("active");
        isValid = false;
      }
      
      // Check if passwords match
      if (passwordInput.value !== confirmPasswordInput.value) {
        confirmPasswordInput.classList.remove("valid");
        confirmPasswordInput.classList.add("invalid");
        confirmPasswordInput.nextElementSibling.textContent = "Passwords do not match.";
        confirmPasswordInput.nextElementSibling.classList.add("active");
        isValid = false;
      }
    }
  }
  return isValid;
}

async function nextStep() {
  // Validate current step
  if (!validateStep()) {
    return;
  }

  // If on step 1, check email against database
  if (currentStep === 1) {
    const emailInput = document.getElementById("email");
    if (emailInput && emailInput.value) {
      try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/check_email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailInput.value })
        });
        
        const data = await response.json();
        
        if (data.exists) {
          // Email already exists, show error
          emailInput.classList.remove("valid");
          emailInput.classList.add("invalid");
          
          const errorMsg = emailInput.nextElementSibling;
          errorMsg.textContent = "This email is already registered.";
          errorMsg.classList.add("active");
          
          return; // Don't proceed to next step
        }
      } catch (error) {
        console.error("Error checking email:", error);
        // Continue anyway since this is just a validation
      }
    }
  }

  // Proceed to next step
  if (currentStep < 4) {
    currentStep++;
    showStep(currentStep);
  }
}

function prevStep() {
  if (currentStep > 1) {
    currentStep--;
    showStep(currentStep);
  }
}

// Handle Form Submission
document.getElementById("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateStep()) return;

  // Collect all form inputs
  const formInputs = document.querySelectorAll('#signupForm input, #signupForm select, #signupForm textarea');
  
  // Create a data object from the inputs
  const data = {};
  formInputs.forEach(input => {
    if (input.id && input.value) {
      data[input.id] = input.value;
    }
  });

  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/auth_signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (response.status === 409) {
      alert("Email already exists. Please use a different email.");
    }
    else if (response.ok) {
      localStorage.setItem("user", JSON.stringify(data));
      
      alert("Sign up successful!");
      
      // Redirect to dashboard
      window.location.href = "../dashboard/index.html";
    } else {
      alert("An error occurred. Please try again.");
    }
  } catch (error) {
    alert("Network error. Please check your connection.");
  }
});

// Initialize the form
showStep(currentStep);

// Add event listeners for navigation buttons
document.getElementById("nextBtn").addEventListener("click", nextStep);
document.getElementById("prevBtn").addEventListener("click", prevStep);