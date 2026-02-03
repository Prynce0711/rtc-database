# RTC Database Project

## Description

This project is a full-stack application that utilizes a Node.js backend with Express and a React frontend built with Vite. It includes user authentication and a health check endpoint, along with a UDP broadcast feature.

## Installation

### Backend

1. Navigate to the `BackEnd` directory:
   ```bash
   cd BackEnd
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file in the `BackEnd` directory and set the necessary environment variables.

### Frontend

1. Navigate to the `FrontEnd` directory:
   ```bash
   cd FrontEnd
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```

## Usage

### Starting the Backend

1. Navigate to the `BackEnd` directory.
2. Start the server:
   ```bash
   pnpm run dev
   ```
3. The server will run on `http://localhost:3000`.

### Starting the Frontend

1. Navigate to the `FrontEnd` directory.
2. Start the development server:
   ```bash
   pnpm run dev
   ```
3. The frontend will be available at `http://localhost:5173`.

## API Endpoints

- **Health Check**: `GET /health` - Check if the server is running.
- **Authentication**: `POST /api/auth` - Handle user authentication.

## Contributing

Contributions are welcome! Please follow the standard Git workflow:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Submit a pull request.

## License

This project is licensed under the MIT License.
