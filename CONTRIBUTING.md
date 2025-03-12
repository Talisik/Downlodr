# Contributing to Downlodr

Thank you for your interest in contributing to Downlodr! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- Code of Conduct
- Getting Started
  - Prerequisites
  - Setting Up the Development Environment
- Development Workflow
  - Branching Strategy
  - Commit Guidelines
  - Pull Request Process
- Coding Standards
  - TypeScript Guidelines
  - React Best Practices
  - ESLint and Prettier
- Project Structure
- Testing
- Documentation
- Reporting Bugs
- Feature Requests

## Code of Conduct

Please read and follow our Code of Conduct (CODE_OF_CONDUCT.md) to foster an inclusive and respectful community.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (version ^20.17.0)
- yarn (version ^v1.22.19)

### Setting Up the Development Environment

1. Fork the repository on GitHub.

2. Clone your forked repository:
   git clone https://github.com/YOUR_USERNAME/downlodr.git

3. Navigate to the project directory:
   cd downlodr

4. Install the dependencies:
   yarn

5. Start the development server:
   yarn start

## Development Workflow

### Branching Strategy

- `main`: The production branch containing stable code
- `develop`: The development branch for integrating features
- Feature branches: Create from `develop` with the naming convention `feature/your-feature-name`
- Bug fix branches: Create from `develop` with the naming convention `fix/issue-description`

### Commit Guidelines

Follow these guidelines for commit messages:

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Example:

Add download pause functionality

- Implement pause button in UI
- Add state management for paused downloads
- Update documentation

Fixes #123

### Pull Request Process

1. Create a pull request from your feature branch to the `develop` branch
2. Ensure your code follows the project's coding standards
3. Update documentation if necessary
4. Include a clear description of the changes and their purpose
5. Request a review from at least one maintainer
6. Address any feedback from reviewers

## Coding Standards

### TypeScript Guidelines

- Use TypeScript for all new code
- Define interfaces for props, state, and complex objects
- Use proper type annotations instead of `any` when possible
- Follow the existing pattern of organizing types and interfaces

### React Best Practices

- Use functional components with hooks
- Keep components small and focused on a single responsibility
- Use the Zustand store for state management
- Follow the existing component structure and naming conventions

### ESLint and Prettier

The project uses ESLint and Prettier for code formatting and linting. The configuration is in `.eslintrc.json`.

- Run linting before submitting a PR:
  yarn lint

- The project uses the following ESLint rules:
  - Single quotes for strings
  - No unused variables (warning level)
  - Import ordering
  - And other rules as defined in the `.eslintrc.json` file

## Project Structure

downlodr/
├── src/                    # Source code
│   ├── Assets/             # Images, icons, and other static assets
│   ├── Components/         # React components
│   │   ├── Main/           # Main application components
│   │   │   ├── Modal/      # Modal components
│   │   │   └── Shared/     # Shared components (Navigation, TitleBar, etc.)
│   │   └── SubComponents/  # Smaller, reusable components
│   │       ├── custom/     # Custom components
│   │       └── shadcn/     # ShadCN UI components
│   ├── DataFunctions/      # Utility functions for data processing
│   ├── Pages/              # Page components
│   ├── Store/              # Zustand stores
│   ├── global.d.ts         # Global type definitions
│   ├── index.css           # Global CSS
│   └── main.ts             # Electron main process
├── forge.config.ts         # Electron Forge configuration
└── package.json            # Project dependencies and scripts

## Testing

Currently, the project does not have automated tests. If you're adding tests:

- Place test files next to the files they test with a `.test.ts` or `.test.tsx` extension
- Focus on testing component behavior and utility functions

## Documentation

- Add JSDoc comments to all functions, components, and complex code
- Follow the existing documentation style:

/**
 * A custom React component
 * Brief description of what the component does
 *
 * @param props - Description of props
 * @returns JSX.Element - The rendered component
 */

## Reporting Bugs

When reporting bugs, please include:

1. A clear and descriptive title.
2. Steps to reproduce the issue.
3. Expected behavior.
4. Actual behavior.
5. Screenshots if applicable.
6. Your environment (OS, Node.js version, etc.)

## Feature Requests

Feature requests are welcome. Please provide:

1. A clear and descriptive title.
2. A detailed description of the proposed feature.
3. Any relevant mockups or examples.
4. Why this feature would be beneficial to the project.
