import CONFIG from "../config.js";

document.addEventListener('DOMContentLoaded', () => {
  const userData = JSON.parse(localStorage.getItem('user'));
  if (!userData) {
    window.location.href = '../login/index.html';
    return;
  }

  const dayTypeSelector = document.getElementById('day-type');
  if (dayTypeSelector) {
    dayTypeSelector.value = isWeekend() ? 'weekend' : 'weekday';
  }

  setUserInfo(userData);
  loadMealPlan();
  setupEventListeners();

  const header = document.querySelector('.transparent-header');
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('active');
    } else {
      header.classList.remove('active');
    }
  });
  
  window.dispatchEvent(new Event('scroll'));
});

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function setUserInfo(userData) {
  const username = document.getElementById('username');
  if (username) {
    username.textContent = userData.name || 'User';
  }
  
  const profileName = document.getElementById('profile-name');
  const profileEmail = document.getElementById('profile-email');
  
  if (profileName) {
    profileName.textContent = userData.name || 'User';
  }
  
  if (profileEmail) {
    profileEmail.textContent = userData.email || 'user@example.com';
  }
}

function setupEventListeners() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('user');
      window.location.href = '../index.html';
    });
  }
  
  const dayTypeSelector = document.getElementById('day-type');
  if (dayTypeSelector) {
    dayTypeSelector.addEventListener('change', () => {
      loadMealPlan();
    });
  }
  
  const refreshBtn = document.getElementById('refresh-meal-plan');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadMealPlan(true);
    });
  }
}

async function loadMealPlan(forceRefresh = false) {
  try {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData) return;
    
    let userId;
    if (userData._id) {
      userId = userData._id;
    } else if (userData.email) {
      userId = encodeURIComponent(userData.email);
    } else {
      throw new Error('No valid user identifier found');
    }
    
    const dayType = document.getElementById('day-type').value;
    
    const mealPlanContainer = document.getElementById('meal-plan-container');
    mealPlanContainer.innerHTML = `
      <div class="loading">
        <ion-icon name="nutrition-outline" class="loading-icon"></ion-icon>
        <p>Loading your personalized meal plan...</p>
      </div>
    `;
    
    const endpoint = forceRefresh ? 'food/refresh' : 'food/suggest';
    
    const response = await fetch(`${CONFIG.API_BASE_URL}/${endpoint}?user_id=${userId}`);
 
    if (!response.ok) {
      throw new Error(`Failed to load meal plan: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.day_type && document.getElementById('day-type')) {
      document.getElementById('day-type').value = data.day_type;
    }
    
    displayMealPlan(data.meals);
    
  } catch (error) {
    console.error('Error loading meal plan:', error);
    
    const mealPlanContainer = document.getElementById('meal-plan-container');
    mealPlanContainer.innerHTML = `
      <div class="error-message">
        <ion-icon name="alert-circle-outline"></ion-icon>
        <p>Unable to load your meal plan. Please try again later.</p>
        <button id="retry-btn" class="btn btn-small">Try Again</button>
      </div>
    `;
    
    document.getElementById('retry-btn')?.addEventListener('click', () => {
      loadMealPlan();
    });
  }
}

function displayMealPlan(meals) {
  const mealPlanContainer = document.getElementById('meal-plan-container');
  mealPlanContainer.innerHTML = '';
  
  if (!meals) {
    mealPlanContainer.innerHTML = `
      <div class="error-message">
        <p>No meal plan available. Please try refreshing.</p>
      </div>
    `;
    return;
  }
  
  const template = document.getElementById('meal-card-template');
  
  const mealTitles = {
    breakfast: 'Breakfast',
    morning_snack: 'Morning Snack',
    lunch: 'Lunch',
    afternoon_snack: 'Afternoon Snack',
    dinner: 'Dinner'
  };
  
  for (const [mealType, mealData] of Object.entries(meals)) {
    const mealCard = template.content.cloneNode(true);
    
    mealCard.querySelector('.meal-time').textContent = mealTitles[mealType] || mealType;
    mealCard.querySelector('.meal-name').textContent = mealData.meal;
    mealCard.querySelector('.nutrition-value.calories').textContent = mealData.calories;
    mealCard.querySelector('.nutrition-value.protein').textContent = mealData.protein;
    mealCard.querySelector('.nutrition-value.carbs').textContent = mealData.carbs;
    mealCard.querySelector('.nutrition-value.fat').textContent = mealData.fat;
    
    const ingredientsList = mealCard.querySelector('.ingredients-list');
    mealData.ingredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.textContent = ingredient;
      ingredientsList.appendChild(li);
    });
    
    mealCard.querySelector('.preparation-text').textContent = mealData.preparation;
    mealPlanContainer.appendChild(mealCard);
  }
}