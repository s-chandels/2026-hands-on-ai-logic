# **Build Real-Time Local Movie Search with Firebase AI Logic**

* **Prerequisites:** Completion of the [Build with Firebase Data Connect (web)](https://firebase.google.com/codelabs/firebase-dataconnect-web) codelab.  
* **Topic:** Implementing "AI Logic" with Gemini 3 Flash and Google Search Grounding.

## **1\. Overview**

In the previous codelab, you built a robust movie review application using Firebase Data Connect and Cloud SQL. You defined a schema for `Movies`, `Reviews`, and `Users`, and built a UI to filter them.

Standard database queries are excellent for structured data ("Find movies released in 2024"). However, they struggle with two types of user needs:

1. **Vague or Conceptual Intents:** "I want to watch a movie that feels like a warm hug."  
2. **Real-Time World Knowledge:** "What similar movies are playing at the cinema downtown right now?"

In this module, we will implement **Firebase AI Logic** to bridge this gap.

### **The Architecture**

We will leave most of the app as it is \- we don’t need to change any fundamental components or the database schema in order to implement new features matching these user needs.

What we’ll do instead is add some AI Agent features on top of what we’ve already built to enhance our app further and allow users to find movies similar to what’s in our movie database playing in realtime, near their neighborhood or any other desired location.

Our **AI Agent usage pattern** will be as follows:

1. **Using Gemini 3 to search for similar movies now playing in realtime:** We will use multimodal search using Firebase AI Logic and Gemini 3 by providing metadata for the current movie the user is viewing and the desired location  
2. **Specifying which tools our AI Agent should use** to satisfy our requirements (e.g. using Google Search).  
3. **Specifying which format we want Gemini to return response data** to display in our app  
4. **Handling the response data** by displaying it in the web application page

### **What you'll build**

* **AI Logic Service:** A client-side service that queries Gemini with Google Search tools.  
* **Structured Prompting:** A technique to force the AI to return JSON data we can use in code.

## **2\. Enable Firebase AI Logic API in the Firebase console**

We will use "Firebase AI Logic" as part of today's codelab. Please follow the steps below to enable Firebase AI Logic in your Cloud project.

1. in the [Cloud Console](https://cloud.google.com/console), search for "Firebase" in the product search bar and click Firebase from the search results.
2. Scroll down and find Firebase AI Logic in the list of Firebase products.
3. Click "Get Started" and authorize the move to the Firebase console.

![Get started with Firebase AI Logic from the Cloud console](codelab-images/image-1-get-started-with-firebase-ai-logic.png) 

4. When you move to the Firebase console, you will see the following page:

![Firebase project creation page](codelab-images/image-2-get-started-with-firebase.png) 

5. After clicking on Get Started with Firebase, you will see the following project setup page:

![Project setup steps](codelab-images/image-3-project-setup-steps.png)

5. Go through the project setup steps taking note of all of the following:
  - Instead of entering a new Firebase project name and creating a new project, select "Add Firebase to Google Cloud Project" as highlighted in the screenshot above and select the Google Cloud project you previously created.
  - Check "I accept the Firebase terms"
  - On "Google Analytics..", turn Enable Google Analytics for this project to OFF and click Continue
  - Your Firebase project should now be set up and you should see page shown below:

![Get started with Firebase AI Logic in the Firebase console](codelab-images/image-4-firebase-ai-logic-get-started.png)

6. Click the "Get started" button to enable Firebase AI Logic.

7. On Gemini Developer API, click "Get started with this API". You can also use Vertex AI Gemini API, however there is currently a bug that might prevent this.

![Select Gemini Developer API onboarding page](codelab-images/image-5-select-gemini-developer-api.png)

Complete the following steps:
  - Click on "Enable API"
  - You can skip the "Enable AI monitoring" step
  - On the "Add an app to start" screen, clck on the web app icon.

  You should see the screen below:

  ![Add Firebase to your web app](codelab-images/image-6-add-firebase-to-your-web-app.png)

8. Add any name for your web app and click on "Register app". You'll see a screen similar to the one shown below come up next:

![Project configuration settings screen](codelab-images/image-7-project-config-screen.png)

9. Copy the project configuration section as shown in the screenshot.

10. Paste and replace these contents in the project configuration settings in your `firebase.tsx (app/src/lib/firebase.tsx)` file.

![Replace project configuration settings in your local dev environment](codelab-images/image-8-replace-project-configurations.png)

11. Go back to the Firebase console and click on "Continue to console" and then "Continue" to complete the setup.

## **3\. Set up Firebase AI Logic in your application **

To access Gemini models directly from your client application, we use the Firebase AI Logic SDK.

### **1\. Enable Firebase AI Logic SDK**

1. In `firebase.tsx (app/src/lib/firebase.tsx)`, **add** the following import statement at the top of your `firebase.tsx` file:

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
```

## **4\. Configure the Search-Enabled Model**

In this step, we are going to define the specific configuration for our AI model. We aren't just instantiating a standard text model here; we are giving it the ability to access the outside world using **Grounding**.

**The Goal:** Create a function that returns a Gemini model capable of performing Google Searches to retrieve real-time information. This will act as an agent using a search tool to return responses to our app.

### **1\. Initialize the service**

In `firebase.tsx (app/src/lib/firebase.tsx)`, add the following line of code:

```javascript
const ai = getAI(firebaseApp);
```

This will initialize the Firebase AI Logic service using getAI. This passes your current firebaseApp configuration (which holds your API keys and project ID) to the AI SDK, creating the bridge between your app and Google's servers.

### **2\. Define the Model Configuration**

In `firebase.tsx (app/src/lib/firebase.tsx)`, add the following lines of code:

```javascript
const ai = getAI(firebaseApp);

export const getSearchEnabledModel = () => {
 return getGenerativeModel(ai, {
   model: "gemini-3-flash-preview",
   tools: [{ googleSearch: {} }]
 });
};
```

Inside `getSearchEnabledModel`, we call `getGenerativeModel`. This is where the magic happens. We pass it two distinct pieces of configuration:

**The Model (`model`):** We are selecting `"gemini-3-flash-preview"`. This is the specific version of the Large Language Model (LLM) we want to use. The "Flash" models are optimized for speed and low latency, making them excellent for user-facing applications.

**The Tools (`tools`):**

```javascript
tools: [{ googleSearch: {} }]
```

This is the critical addition. By passing the `googleSearch` tool in the `tools` array, you are enabling **Grounding**.

* **Without this:** The model relies solely on its training data (which has a cut-off date).  
  * **With this:** The model can recognize when a user asks a question about current events or specific facts (e.g., "What is the stock price of Alpha right now?") and automatically use Google Search to find the answer before generating a response.

**Key Takeaways:**

* **`googleSearch: {}`**: This single line gives the LLM access to live information from Google Search, allowing it to answer questions about current showtimes which it wouldn't know otherwise.

## **5\. Build the Theatre Search Prompt & Interface**

Now that we have our search-enabled model configured, we need a frontend to interact with it. In this step, we will use the `FindTheatresPage` component, which has been pre-created for this purpose.

**The Goal:** Use a React interface that captures the user's location and date, sends a structured prompt to Gemini, and renders the showtimes found via Google Search.

In `App.tsx (app/src/App.tsx)`, uncomment the following two lines to add the FindTheatres.tsx page and enable the root to the page in the root App.tsx component:

```javascript
import FindTheatresPage from "./pages/FindTheatres";
//...<Route path="/findtheatres" element={<FindTheatresPage />} />
```

Let’s breakdown some of the key logic within the FindTheatres.tsx component:

### **1\. Setup and State Management**

We use standard React hooks to manage the user's input.

* **`useSearchParams`**: Pulls the movie title or tags passed from the previous screen (e.g., if the user clicked "Find Showtimes" on a specific movie poster).  
* **`handleUseMyLocation`**: Uses the browser's native Geolocation API to get accurate coordinates (`latitude, longitude`) if the user prefers that over typing a city name.

### **2\. The Prompt Engineering Strategy**

The core of this component is the `handleSearch` function. Look closely at how we construct the `prompt`:

```json
Context: User wants to see the movie matching "${tags || movieTitle}" in a theatre.
           Location: ${location}
           Date: ${date}

           Task:
           1. Find 2-3 movies similar to "${tags || movieTitle}" currently playing in this city.
           2. Return strict JSON format.

           JSON Schema:
           {
               "movies": [
                   {
                       "title": "Movie Title",
                       "description": "Movie description",
                       "isTargetMovie": true,
                       "theatres": [
                           { "name": "Cinema Name", "showtimes": ["7:00 PM", "9:30 PM"] }
                       ]
                   }
               ]
           }
```

**Why do we do this?**

* **Context Injection:** We explicitly feed the `location` and `date` into the prompt so the Google Search tool knows exactly *where* and *when* to look.  
* **Structured Output (JSON Mode):** LLMs typically output conversational text. However, our UI needs arrays and objects to render the list of theatres cleanly. By explicitly asking for a "strict JSON format" and providing a **JSON Schema**, we force the model to format its search findings into machine-readable code.

### **3\. Execution and Parsing**

We have the following two interfaces to map to the model responses based on the JSON schema in the prompt:

```javascript
interface Theatre {
 name: string;
 showtimes: string[];
}

interface MovieResult {
 title: string;
 isTargetMovie: boolean;
 description: string;
 theatres: Theatre[];
}
```

Inside handleSearch, we execute the call:

1. **Call the Model:** `model.generateContent(...)` triggers the AI. The AI sees the request for "current showtimes," recognizes it needs external data, performs a Google Search, and synthesizes the results.

2. **Clean and Parse:**  
````javascript
const cleanJson = text.replace(/```json|```/g, "").trim();
const data = JSON.parse(cleanJson);
````

3. We strip out any markdown code blocks the AI might add (like \`\`\`json) to ensure `JSON.parse` doesn't crash.

4. **Grounding Metadata:** We specifically save `response.candidates?.[0]?.groundingMetadata`. This contains the "proof"—the links to the actual cinema websites where the data was found.

### **4\. The UI Rendering**

The return statement handles the visual presentation using Tailwind CSS.

* **Input Section:** A split layout allowing users to change the date or location easily.  
* **Results Loop:** We map through the `movies` array.

## **6\. See it in action**

1. Start your application: `npm run dev`.  
2. Click on a movie and press the “Find Theatres” button  
3. Enter the date and time and click on the “Find Showtimes” button  
4. Wait for Gemini to get back to you with similar movies playing in the location you set\!
