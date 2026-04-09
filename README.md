# AI Agent for Listing, Booking, and Review Services (SE4458 - Assignment 2)

## Project Information
* **Student Name:** Ayşenur Tombul
* **Group:** Group 2 (Listing Services)
* **Project Goal:** Developing an AI-powered chat application that integrates with Midterm APIs (Listing, Booking, and Review services) using an Agentic Workflow.

---

## System Architecture
The project is built on the Model Context Protocol (MCP) to ensure a modular and secure communication flow between the LLM and the backend services.

* **Frontend:** A web-based chat UI (React) for real-time messaging.
* **Agent Backend:** A Node.js server acting as the orchestrator between the user and the LLM.
* **LLM (Large Language Model):** Local Llama 3 running via Ollama for intent parsing and tool selection.
* **MCP Server:** Handles tool definitions and maps LLM requests to the correct API Gateway endpoints.
* **API Gateway:** Routes all requests to the existing Midterm service endpoints.
* **Midterm APIs:** Core business logic for searching listings, creating bookings, and fetching reviews.

---

## Assumptions and Design Choices
* **Shift to Local LLM:** Initially, OpenAI was integrated. However, due to its pricing policy and API credit constraints, the project was migrated to Ollama (Llama 3). This ensures the project remains free to run locally without requiring cloud deployment.
* **Context Awareness:** The system is designed to maintain conversation history. This allows users to perform actions like "Show reviews for this place" without re-entering technical UUIDs.
* **Authentication:** Constant user credentials are used for gateway authentication to simplify the demonstration flow.

---

## Challenges Encountered
1. **Model Migration (OpenAI to Ollama):** The most significant challenge was switching from OpenAI to a local LLM. While OpenAI provided high accuracy, its cost led to the selection of Ollama. Adjusting the system prompts for Llama 3 to achieve the same level of intent parsing was a critical learning phase.
2. **Entity Resolution:** Mapping natural language (e.g., "Champs-Élysées Luxury") to specific database UUIDs required fine-tuning the system prompt to prevent the model from asking for technical IDs.
3. **Tool Call Execution:** Handling raw JSON outputs from the local LLM and ensuring the backend automatically executes the tool instead of just displaying the JSON string was a complex logic to implement.

---

## Presentation Video
You can watch the live demonstration of the project here:
**https://youtu.be/lRwsiFUwtLE**

