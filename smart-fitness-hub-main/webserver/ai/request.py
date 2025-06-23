import aiohttp
import asyncio
import os
from dotenv import load_dotenv
load_dotenv("webserver/.env")

API_KEY = os.getenv("AI_API_KEY")

async def do_request(content):
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }
    
    payload = {
        "messages": [
            {"role": "user", "content": content}
        ],
        "model": "gemma2-9b-it",
        "temperature": 1,
        "max_completion_tokens": 3000,
        "top_p": 1,
        "stream": False,
        "stop": None
    }

    async with aiohttp.ClientSession() as session:
      for i in range(5):
        async with session.post(url, headers=headers, json=payload) as response:
            if response.status == 200:
              response = await response.json()
              response = response['choices'][0]['message']['content']
              return response
            
            elif response.status == 429:  
              print(f"Failed to get answer for {content} with status code {response.status}. Attempt failed with status code 429. Retrying...")
              # Exponential backoff
            else:
              print(f"Failed to get answer for {content} with status code {response.status}")
              return 
