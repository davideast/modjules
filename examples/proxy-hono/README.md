# Hono Proxy Example for modjules

This example demonstrates how to create a secure proxy server for the `modjules` SDK using [Hono](https://hono.dev/), a lightweight and fast web framework for a variety of JavaScript runtimes.

The proxy server handles two main responsibilities:
1.  **Authentication**: It securely verifies the user's identity before allowing them to interact with the Jules API.
2.  **API Key Management**: It keeps the `JULES_API_KEY` private on the server, preventing it from being exposed in the client-side browser code.

## How it Works

The core of this example is the `createNodeHandler` function from the `modjules/proxy` module. This function creates a standard Web API-compatible handler (`Request => Response`) that can be easily integrated with frameworks like Hono, Next.js, or Express.

The handler manages the handshake process for issuing secure, short-lived client tokens and then proxies subsequent requests to the Jules API.

## Setup

1.  **Install Dependencies**:
    Navigate to this directory and install the required packages.

    ```bash
    npm install
    ```

2.  **Configure Environment Variables**:
    Copy the example environment file to a new `.env` file.

    ```bash
    cp .env.example .env
    ```

    Now, open `.env` and add your credentials:
    *   `JULES_API_KEY`: Your API key for the Jules API.
    *   `JULES_CLIENT_SECRET`: A secure, randomly generated string (e.g., with `openssl rand -hex 32`) used to sign the client-side tokens.

## Running the Server

You can run the server in either development or production mode.

*   **Development**:
    This command starts the server with `tsx` and automatically reloads it when you make changes to the source code.

    ```bash
    npm run dev
    ```

*   **Production**:
    This command runs the server using `tsx`.

    ```bash
    npm run start
    ```

The proxy will be running on `http://localhost:3000`.

## Core Logic (`src/index.ts`)

-   **Initialization**: The `createNodeHandler` is initialized with the `apiKey` and `clientSecret`.
-   **Auth Strategy**: A `verify` function is provided to authenticate requests. In this example, it simulates checking an `authToken`. In a real-world application, you would replace this with a proper verification method, such as validating a Firebase ID token or a session cookie.
-   **Routing**: The Hono app mounts the handler on the `/api/jules` route. The `c.req.raw` method is used to pass the standard `Request` object to our handler.
-   **CORS**: Cross-Origin Resource Sharing (CORS) is enabled to allow requests from your front-end application.
