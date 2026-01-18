/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getGenerativeModel } from "firebase/ai";
import { ai } from "./firebase";

export const getSearchEnabledModel = () => {
    return getGenerativeModel(ai, {
        model: "gemini-3-flash-preview",
        tools: [{ googleSearch: {} }]
    });
};

export interface CinemaShowtime {
    cinemaName: string;
    movieTitle: string;
    showtimes: string[];
}

export const findSimilarMoviesNearby = async (
    movieTitle: string,
    movieDescription: string,
    movieImageUrl: string,
    location: GeolocationCoordinates
): Promise<CinemaShowtime[]> => {
    const model = getSearchEnabledModel();

    const prompt = `
    Find showtimes for movies similar to "${movieTitle}" near latitude ${location.latitude}, longitude ${location.longitude}.
    The movie description is: "${movieDescription}".
    Here is an image of the movie: ${movieImageUrl}
    
    Please use Google Search to find cinemas playing similar style/genre movies nearby right now.
    Return the results in a strictly JSON format as a list of objects with the following keys:
    - cinemaName (string): Name of the cinema
    - movieTitle (string): Title of the movie playing
    - showtimes (array of strings): List of showtimes (e.g. "7:00 PM", "9:30 PM")

    Example JSON output:
    [
        { "cinemaName": "AMC Empire 25", "movieTitle": "Top Gun: Maverick", "showtimes": ["19:00", "21:30"] }
    ]
    `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Basic cleanup to extract JSON if the model returns markdown code blocks
        const jsonMatch = text.match(/```json\n([\s\S]*)\n```/) || text.match(/```\n([\s\S]*)\n```/);
        const jsonString = jsonMatch ? jsonMatch[1] : text;

        return JSON.parse(jsonString);
    } catch (error) {
        console.error("Error finding similar movies:", error);
        return [];
    }
};
