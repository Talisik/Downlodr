# Downlodr Cursor Rules

## Overview

This directory contains a comprehensive set of Cursor rules (`.mdc` files) specifically designed for the Downlodr project. These rules establish consistent development patterns, best practices, and quality standards across the entire codebase.

## Rule Categories

### 📋 Core Rules (`core/`)
Foundation rules that apply to all aspects of the project:
- **style.mdc** - Code formatting and style standards
- **naming.mdc** - Naming conventions for files, variables, functions, and components
- **structure.mdc** - Project structure and file organization guidelines

### ⚛️ Frontend Rules (`frontend/`)
Technology-specific rules for frontend development:
- **react.mdc** - React development standards and component patterns
- **typescript.mdc** - TypeScript type safety and development practices
- **tailwind.mdc** - Tailwind CSS styling and design system guidelines

### 💻 Desktop Rules (`desktop/`)
Electron-specific development standards:
- **electron.mdc** - Electron security, IPC, and desktop integration best practices

### 🔌 Plugin Rules (`plugins/`)
Plugin system development and API standards:
- **plugin-development.mdc** - Plugin architecture and development guidelines
- **plugin-api.mdc** - Plugin API design and usage standards

### 🛡️ Quality Rules (`quality/`)
Quality assurance and security standards:
- **testing.mdc** - Comprehensive testing strategies and practices
- **security.mdc** - Security standards for application and plugin development

### 🚀 Deployment Rules (`deployment/`)
Build, packaging, and deployment standards:
- **electron-forge.mdc** - Electron Forge packaging and distribution guidelines

## Rule Priority Levels

- **Critical** - Security-related rules that must be followed
- **High** - Core architectural and safety rules
- **Medium** - Best practices and consistency rules
- **Low** - Optimization and enhancement suggestions

## Implementation Roadmap

### Phase 1: Core Foundation (Week 1-2)
1. Implement core style and naming conventions
2. Set up ESLint and Prettier configurations
3. Establish project structure standards
4. Train team on new conventions

### Phase 2: Technology Standards (Week 3-4)
1. Implement React and TypeScript development standards
2. Set up Tailwind CSS design system
3. Establish Electron security practices
4. Update existing components to match standards

### Phase 3: Quality Assurance (Week 5-6)
1. Implement testing frameworks and standards
2. Set up security scanning and validation
3. Establish code review guidelines
4. Create quality gates for CI/CD

### Phase 4: Plugin System (Week 7-8)
1. Implement plugin development standards
2. Set up plugin security validation
3. Create plugin API documentation
4. Establish plugin review process

### Phase 5: Deployment Optimization (Week 9-10)
1. Optimize Electron Forge configuration
2. Set up cross-platform build pipeline
3. Implement automated testing and deployment
4. Establish release management process

## Usage Guidelines

### For Developers
1. **Read relevant rules** before starting new features
2. **Follow naming conventions** for all new code
3. **Use provided patterns** for common scenarios
4. **Request clarification** when rules conflict or are unclear

### For Code Reviews
1. **Reference specific rules** when providing feedback
2. **Check compliance** with established patterns
3. **Suggest improvements** based on best practices
4. **Ensure security standards** are met

### For New Team Members
1. **Start with core rules** to understand foundations
2. **Review technology-specific rules** for your area
3. **Follow examples** provided in rule documentation
4. **Ask questions** when patterns are unclear

## Maintenance

### Regular Reviews
- **Monthly rule reviews** to ensure relevance and accuracy
- **Quarterly updates** based on technology changes
- **Annual comprehensive reviews** of all standards

### Updates and Changes
- **Version control** all rule changes
- **Document rationale** for rule modifications
- **Communicate changes** to all team members
- **Provide migration guides** for breaking changes

## Enforcement

### Automated Enforcement
- ESLint rules for code style and patterns
- TypeScript compiler for type safety
- Prettier for code formatting
- CI/CD pipeline checks

### Manual Enforcement
- Code review guidelines and checklists
- Architecture review processes
- Security audit procedures
- Quality assurance protocols

## Resources

### Documentation
- [Project Architecture](../docs/architecture.md)
- [Plugin Development Guide](../docs/PLUGIN_DEVELOPMENT.MD)
- [Contributing Guidelines](../CONTRIBUTING.md)

### Tools and Configuration
- [ESLint Configuration](../.eslintrc.json)
- [Prettier Configuration](../.prettierrc)
- [TypeScript Configuration](../tsconfig.json)
- [Tailwind Configuration](../tailwind.config.js)

---

**Note**: These rules are living documents that evolve with the project. Always check for the latest version and don't hesitate to suggest improvements or ask questions.