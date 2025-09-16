# Waste Management Application

This repository is currently in its initial state with minimal setup. Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Repository Status
**IMPORTANT**: This repository is currently a starter/minimal repository containing only a README.md file. No build system, dependencies, or source code have been established yet.

## Working Effectively

### Initial Repository Assessment
- Always run `ls -la` and `find . -type f | grep -v .git` first to understand the current state
- Check for existence of package.json, requirements.txt, Cargo.toml, or other project files to identify the tech stack
- Review README.md for any setup instructions that may have been added since these instructions were created

### When No Build System Exists (Current State)
- The repository currently contains only README.md
- No dependencies to install
- No build commands to run
- No tests to execute
- Focus on understanding the intended application domain (waste management) and prepare for future development

### Future Development Scenarios

#### If Node.js/JavaScript Project is Added
When package.json is detected:
- Install dependencies: `npm install` -- may take 2-5 minutes depending on project size
- Build project: `npm run build` -- timeout should be set to 15+ minutes for complex builds. NEVER CANCEL.
- Run tests: `npm run test` -- timeout should be set to 10+ minutes. NEVER CANCEL.
- Start development server: `npm run dev` or `npm start`
- Run linting: `npm run lint` (always run before committing)
- Format code: `npm run format` (always run before committing)

#### If Python Project is Added  
When requirements.txt or pyproject.toml is detected:
- Create virtual environment: `python -m venv venv`
- Activate environment: `source venv/bin/activate` (Linux/Mac) or `venv\Scripts\activate` (Windows)
- Install dependencies: `pip install -r requirements.txt` -- may take 5-10 minutes. NEVER CANCEL.
- Run tests: `python -m pytest` or `python -m unittest` -- timeout should be set to 15+ minutes. NEVER CANCEL.
- Run application: Check for main.py, app.py, or manage.py files

#### If Java/Maven Project is Added
When pom.xml is detected:
- Install dependencies: `mvn clean install` -- may take 10-30 minutes. NEVER CANCEL.
- Build project: `mvn compile` -- timeout should be set to 20+ minutes. NEVER CANCEL.
- Run tests: `mvn test` -- timeout should be set to 20+ minutes. NEVER CANCEL.
- Package application: `mvn package`

#### If Docker is Added
When Dockerfile is detected:
- Build image: `docker build -t waste-management .` -- may take 15-45 minutes. NEVER CANCEL.
- Run container: `docker run -p 8080:8080 waste-management`
- Check docker-compose.yml for orchestrated services

### Build Time Expectations
**CRITICAL - NEVER CANCEL ANY BUILD OR TEST COMMAND**
- Initial dependency installation: 2-10 minutes typical, up to 30 minutes for complex projects
- Build processes: 5-45 minutes typical, enterprise projects may take 60+ minutes
- Test suites: 5-30 minutes typical, comprehensive test suites may take 60+ minutes
- Docker builds: 10-60 minutes depending on base images and dependencies

**ALWAYS set timeouts to at least double the expected time. If a command appears to hang, wait at least 60 minutes before considering alternatives.**

### Validation Scenarios
Once the application is functional, ALWAYS test these scenarios after making changes:

#### For Web Applications
- Navigate to home page and verify it loads
- Test user registration/login flow if authentication exists
- Perform core waste management operations (e.g., schedule pickup, view routes, manage bins)
- Verify forms submit successfully
- Check responsive design on different screen sizes

#### For CLI Applications  
- Run `--help` command and verify output
- Execute main workflow commands with sample data
- Verify output files are created correctly
- Test error handling with invalid inputs

#### For APIs
- Test health/status endpoints
- Verify authentication endpoints if present
- Test core CRUD operations for waste management entities
- Validate response formats and status codes
- Test error scenarios and edge cases

### Code Navigation

#### Expected Directory Structure (Once Developed)
```
src/                 # Source code
├── components/      # UI components (if web app)
├── services/       # Business logic and API calls  
├── models/         # Data models
├── utils/          # Utility functions
├── tests/          # Test files
public/             # Static assets (if web app)
docs/               # Documentation
config/             # Configuration files
scripts/            # Build and deployment scripts
```

#### Key Files to Monitor
- Always check main entry points (index.js, main.py, App.java) after making core changes
- Review configuration files after environment changes
- Examine test files when adding new features to understand expected behavior
- Check API documentation when modifying endpoints

### Continuous Integration
- Always run linting and formatting before committing
- Ensure all tests pass locally before pushing
- Check for .github/workflows/ directory for CI/CD pipeline requirements
- Validate that any pre-commit hooks execute successfully

### Troubleshooting Common Issues
- **Build Failures**: Check dependency versions and Node.js/Python/Java version compatibility
- **Test Failures**: Verify test database setup and mock data requirements  
- **Runtime Errors**: Check environment variables and configuration files
- **Performance Issues**: Monitor memory usage during builds and consider increasing timeout values

### Environment Setup
- Check for .env.example or similar files for required environment variables
- Verify database connection strings and API keys are properly configured
- Ensure required external services (databases, cache, etc.) are running
- Install any system dependencies mentioned in documentation

## Common Commands Reference

### Repository Exploration (Current State)
```bash
ls -la                              # List all files and directories
find . -type f | grep -v .git      # Find all non-git files
cat README.md                      # View current README content
git --no-pager log --oneline -10   # View recent commits
git --no-pager status              # Check repository status
```

### Output of Current Commands
```
$ ls -la
total 20
drwxr-xr-x 4 runner runner 4096 Sep 16 18:08 .
drwxr-xr-x 3 runner runner 4096 Sep 16 18:06 ..
drwxrwxr-x 7 runner runner 4096 Sep 16 18:08 .git
drwxrwxr-x 2 runner runner 4096 Sep 16 18:09 .github
-rw-rw-r-- 1 runner runner   19 Sep 16 18:06 README.md

$ find . -type f | grep -v .git  
./README.md
./.github/copilot-instructions.md

$ cat README.md
# waste-management-
```

## Critical Reminders
- **NEVER CANCEL builds or tests** - they may take 45+ minutes for complex projects
- **ALWAYS validate functionality** after making changes, not just compilation
- **SET APPROPRIATE TIMEOUTS** - use 60+ minutes for builds, 30+ minutes for tests
- **MANUAL TESTING IS REQUIRED** - execute real user workflows, don't just start/stop the application
- **VALIDATE EVERY COMMAND** before including it in development workflows
- **CHECK FOR UPDATES** - this repository may evolve rapidly from its current minimal state

## Next Steps for Development
1. Determine the target technology stack for the waste management application
2. Add appropriate project configuration files (package.json, requirements.txt, etc.)
3. Establish build and test infrastructure
4. Update these instructions with validated, working commands
5. Add specific waste management domain logic and workflows
6. Implement proper CI/CD pipelines

Remember: These instructions will need updates as the repository evolves from its current minimal state to a full application.