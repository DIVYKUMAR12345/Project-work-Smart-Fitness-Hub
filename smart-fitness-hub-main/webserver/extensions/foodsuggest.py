from fastapi import APIRouter, HTTPException
from datetime import datetime, timedelta
import calendar  
from typing import Optional, List
import json
from bson import ObjectId

from ai import do_request

class FoodSuggest:
    def __init__(self, app):
      
        self.app = app
        self.router = APIRouter()
        self.setup_routes()
        
        self.usersdb = self.app.db["users"]
        self.mealplansdb = self.app.db["mealplans"]
        self.meal_historydb = self.app.db["meal_history"]  
        
        self.lookback_days = 7
        
    def _determine_day_type(self):
        """Auto-detect if today is a weekday or weekend"""
        # Get current day (0 is Monday, 6 is Sunday)
        current_day = datetime.now().weekday()
        
        # 5 (Saturday) and 6 (Sunday) are considered weekend
        if current_day >= 5:
            return "weekend"
        else:
            return "weekday"

    def setup_routes(self):
        @self.router.get("/food/suggest")
        async def get_food_suggestions(
            user_id: str,
            day_type: Optional[str] = None
        ):
            """
            Generate food suggestions for a user based on their profile
            Auto-detects day type if not specified
            """
            # Auto-detect day type if not provided
            if not day_type:
                day_type = self._determine_day_type()
            
            # Validate day_type
            if day_type not in ["weekday", "weekend"]:
                raise HTTPException(status_code=400, detail="day_type must be 'weekday' or 'weekend'")
            
            # Try to find user by ID or email
            user = None
            
            # First try to find by ObjectId
            try:
                if len(user_id) == 24:  # Valid ObjectId is 24 chars
                    user = await self.usersdb.find_one({"_id": ObjectId(user_id)})
            except:
                pass
            
            if not user and '@' in user_id:
                user = await self.usersdb.find_one({"email": user_id})
                
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Check if we have a recent meal plan (less than 24 hours old)
            current_date = datetime.now().strftime("%Y-%m-%d")
            cached_plan = await self.mealplansdb.find_one({
                "user_id": user_id,
                "date": current_date,
                "day_type": day_type
            })
            
            if cached_plan:
                # Return cached meal plan
                cached_plan["_id"] = str(cached_plan["_id"])
                return cached_plan
            
            # Get recent meals 
            recent_meals = await self._get_recent_meals(user_id)
                
            meal_plan = await self._generate_meal_plan(user, day_type, recent_meals)
            
            # Store in database
            meal_plan_doc = {
                "user_id": user_id,
                "date": current_date,
                "day_type": day_type,
                "meals": meal_plan,
                "created_at": datetime.now()
            }
            
            result = await self.mealplansdb.insert_one(meal_plan_doc)
            meal_plan_doc["_id"] = str(result.inserted_id)
            
            # Update meal history
            await self._update_meal_history(user_id, meal_plan)
            
            return meal_plan_doc
            
        @self.router.get("/food/refresh")
        async def refresh_food_suggestions(
            user_id: str,
            day_type: Optional[str] = None
        ):
            """
            Force refresh food suggestions for a user
            Auto-detects day type if not specified
            """
            # Auto-detect day type if not provided
            if not day_type:
                day_type = self._determine_day_type()
            
            # Validate day_type
            if day_type not in ["weekday", "weekend"]:
                raise HTTPException(status_code=400, detail="day_type must be 'weekday' or 'weekend'")
                
            user = None
            
            try:
                if len(user_id) == 24:  # Valid ObjectId is 24 chars
                    user = await self.usersdb.find_one({"_id": ObjectId(user_id)})
            except:
                pass
            
            if not user and '@' in user_id:
                user = await self.usersdb.find_one({"email": user_id})
                
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            
            recent_meals = await self._get_recent_meals(user_id)
            
            # Delete any existing plan for today
            current_date = datetime.now().strftime("%Y-%m-%d")
            await self.mealplansdb.delete_one({
                "user_id": user_id,
                "date": current_date,
                "day_type": day_type
            })
            
            meal_plan = await self._generate_meal_plan(user, day_type, recent_meals)
            
            meal_plan_doc = {
                "user_id": user_id,
                "date": current_date,
                "day_type": day_type,
                "meals": meal_plan,
                "created_at": datetime.now()
            }
            
            result = await self.mealplansdb.insert_one(meal_plan_doc)
            meal_plan_doc["_id"] = str(result.inserted_id)
            
            await self._update_meal_history(user_id, meal_plan)
            
            return meal_plan_doc
            
    async def _get_recent_meals(self, user_id: str) -> List[str]:
        """Get list of recent meals to avoid repetition"""

        cutoff_date = datetime.now() - timedelta(days=self.lookback_days)
        
        # Find meal plans created in the last 7 days
        cursor = self.mealplansdb.find({
            "user_id": user_id,
            "created_at": {"$gte": cutoff_date}
        })
        
        # Extract just the meal names
        recent_meals = []
        async for plan in cursor:
            if "meals" in plan:
                for meal_type, meal_data in plan["meals"].items():
                    if "meal" in meal_data:
                        recent_meals.append(meal_data["meal"].lower())
        
        return recent_meals
        
    async def _update_meal_history(self, user_id: str, meal_plan: dict):
        """Update meal history for a user"""
        history_doc = {
            "user_id": user_id,
            "date": datetime.now(),
            "meals": {meal_type: meal_data["meal"] for meal_type, meal_data in meal_plan.items()},
        }
        await self.meal_historydb.insert_one(history_doc)

    async def _generate_meal_plan(self, user, day_type, recent_meals=None):
        """Generate a meal plan using AI based on user preferences"""
        
        # Extract user preferences
        age = user.get("age", "unknown")
        gender = user.get("gender", "unknown")
        weight = user.get("weight", "unknown")
        height = user.get("height", "unknown")
        dietary_preferences = user.get("dietary-preferences", "no specific preference")
        fitness_goals = user.get("fitness-goals", "general health")
        activity_level = user.get("activity-level", "moderately-active")
        
        # Create avoidance list for recently served meals
        recent_meals_text = ""
        if recent_meals and len(recent_meals) > 0:
            # Limit to 10 recent meals to keep prompt length reasonable
            meals_to_avoid = recent_meals[:10]
            recent_meals_text = f"\nPlease avoid these recently served meals: {', '.join(meals_to_avoid)}."
        
        # Create AI prompt with meal history consideration
        prompt = f"""
        You are a nutrition expert. Create a diverse meal plan for a {gender}, {age} years old, {weight}kg, {height}cm, 
        with {dietary_preferences} dietary preference, {fitness_goals} fitness goal, and {activity_level} activity level.

        This is for a {day_type} (weekday or weekend).{recent_meals_text}
        
        Generate a JSON object with the following structure ONLY, no explanations:

        {{
          "breakfast": {{
            "meal": "Name of breakfast meal",
            "ingredients": ["ingredient 1", "ingredient 2", ...],
            "calories": approximate calories,
            "protein": grams of protein,
            "carbs": grams of carbohydrates,
            "fat": grams of fat,
            "preparation": "Brief preparation instructions"
          }},
          "morning_snack": {{
            // Same structure as breakfast
          }},
          "lunch": {{
            // Same structure as breakfast
          }},
          "afternoon_snack": {{
            // Same structure as breakfast
          }},
          "dinner": {{
            // Same structure as breakfast
          }}
        }}

        Ensure meals are DIFFERENT from the recently served ones, align with {dietary_preferences} preferences, 
        and support {fitness_goals} goals. Provide only the JSON object, no other text.
        """
        
        # Get AI response
        response = await do_request(prompt)
        
        try:
            json_str = response
            if "```json" in response:
                json_str = response.split("```json")[1].split("```")[0].strip()
            elif "```" in response:
                json_str = response.split("```")[1].split("```")[0].strip()
                
            meal_plan = json.loads(json_str)
            
            required_meals = ["breakfast", "morning_snack", "lunch", "afternoon_snack", "dinner"]
            required_fields = ["meal", "ingredients", "calories", "protein", "carbs", "fat", "preparation"]
            
            for meal in required_meals:
                if meal not in meal_plan:
                    raise ValueError(f"Missing meal: {meal}")
                for field in required_fields:
                    if field not in meal_plan[meal]:
                        raise ValueError(f"Missing field {field} in {meal}")
            
            # Check if any meals are in recent_meals
            if recent_meals:
                repeats = []
                for meal_type in required_meals:
                    if meal_plan[meal_type]["meal"].lower() in recent_meals:
                        repeats.append(meal_plan[meal_type]["meal"])
                
                # Log if there are repeats (but still return the plan)
                if repeats:
                    print(f"Warning: {len(repeats)} repeated meals despite avoidance request: {', '.join(repeats)}")
            
            return meal_plan
            
        except (json.JSONDecodeError, ValueError) as e:
            # Instead of returning a default meal plan, throw an error
            print(f"Error parsing AI response: {e}")
            print(f"Raw response: {response}")
            raise HTTPException(
                status_code=500,
                detail="Failed to generate meal plan. Please try again."
            )