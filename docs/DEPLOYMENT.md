# Deployment Guide

## Overview
This guide covers various deployment options for the Waste Management System.

## Prerequisites
- Docker and Docker Compose
- Cloud platform account (AWS, GCP, Azure)
- Domain name (optional, for production)
- SSL certificate (for HTTPS)

## Local Development Deployment

### Using Docker Compose
1. Clone the repository
2. Run the application:
   ```bash
   docker-compose up --build
   ```
3. Access at http://localhost

### Manual Setup
1. Install Python 3.11+
2. Install PostgreSQL
3. Set up virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
4. Configure environment variables
5. Run the application:
   ```bash
   python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
   ```

## Cloud Deployment Options

### AWS Deployment

#### Option 1: ECS with Fargate
1. **Build and push Docker image:**
   ```bash
   # Build image
   docker build -t waste-management .
   
   # Tag for ECR
   docker tag waste-management:latest {account-id}.dkr.ecr.{region}.amazonaws.com/waste-management:latest
   
   # Push to ECR
   docker push {account-id}.dkr.ecr.{region}.amazonaws.com/waste-management:latest
   ```

2. **Set up RDS PostgreSQL:**
   - Create RDS PostgreSQL instance
   - Configure security groups
   - Note connection details

3. **Create ECS Service:**
   - Create task definition with the Docker image
   - Configure environment variables
   - Set up service with load balancer

4. **Configure Application Load Balancer:**
   - Route traffic to ECS service
   - Configure health checks on `/health`

#### Option 2: Elastic Beanstalk
1. Install EB CLI
2. Initialize Elastic Beanstalk:
   ```bash
   eb init
   eb create production
   ```
3. Configure environment variables in EB console
4. Deploy:
   ```bash
   eb deploy
   ```

### Google Cloud Platform

#### Cloud Run Deployment
1. **Build and deploy:**
   ```bash
   gcloud builds submit --tag gcr.io/{project-id}/waste-management
   gcloud run deploy --image gcr.io/{project-id}/waste-management --platform managed
   ```

2. **Set up Cloud SQL:**
   ```bash
   gcloud sql instances create waste-management-db --database-version=POSTGRES_13
   gcloud sql databases create waste_management --instance=waste-management-db
   ```

3. **Configure environment variables:**
   ```bash
   gcloud run services update waste-management \
     --set-env-vars="DATABASE_URL=postgresql://..."
   ```

### Azure Deployment

#### Container Instances
1. **Create resource group:**
   ```bash
   az group create --name waste-management-rg --location eastus
   ```

2. **Deploy container:**
   ```bash
   az container create \
     --resource-group waste-management-rg \
     --name waste-management \
     --image waste-management:latest \
     --dns-name-label waste-management-app \
     --ports 8000
   ```

3. **Set up Azure Database for PostgreSQL:**
   ```bash
   az postgres server create \
     --resource-group waste-management-rg \
     --name waste-management-db \
     --location eastus \
     --admin-user dbadmin \
     --admin-password {password} \
     --sku-name GP_Gen5_2
   ```

## Environment Variables

### Required Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-domain.com,www.your-domain.com
```

### Optional Variables
```bash
REDIS_URL=redis://localhost:6379/0
SENTRY_DSN=https://your-sentry-dsn
LOG_LEVEL=INFO
```

## SSL/HTTPS Configuration

### Using Let's Encrypt with Nginx
1. Install Certbot
2. Generate certificate:
   ```bash
   certbot --nginx -d your-domain.com
   ```
3. Update nginx configuration for HTTPS

### Using Cloud Provider SSL
- AWS: Use Certificate Manager
- GCP: Use Google-managed SSL certificates
- Azure: Use App Service certificates

## Database Setup

### PostgreSQL Configuration
1. **Create database:**
   ```sql
   CREATE DATABASE waste_management;
   CREATE USER waste_user WITH PASSWORD 'secure_password';
   GRANT ALL PRIVILEGES ON DATABASE waste_management TO waste_user;
   ```

2. **Configure connection pooling (recommended):**
   - Use PgBouncer for connection pooling
   - Configure in docker-compose or cloud setup

### Database Migrations (Future)
When adding SQLAlchemy migrations:
```bash
alembic init alembic
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

## Monitoring and Logging

### Health Checks
The application provides a health check endpoint at `/health`

### Logging
- Application logs are written to stdout
- Configure log aggregation (CloudWatch, Stackdriver, etc.)

### Monitoring
Recommended monitoring setup:
- **Uptime monitoring**: Ping `/health` endpoint
- **Application monitoring**: Use APM tools like New Relic, Datadog
- **Infrastructure monitoring**: Use cloud provider monitoring

## Scaling Considerations

### Horizontal Scaling
- Use load balancer to distribute traffic
- Deploy multiple container instances
- Use session storage (Redis) for user sessions

### Database Scaling
- Use read replicas for read-heavy workloads
- Implement connection pooling
- Consider database sharding for large datasets

### Caching
- Implement Redis for caching frequent queries
- Use CDN for static assets
- Cache API responses where appropriate

## Security Considerations

### Application Security
- Enable HTTPS in production
- Use environment variables for secrets
- Implement rate limiting
- Add authentication/authorization
- Validate all input data

### Infrastructure Security
- Use private networks for database
- Configure security groups/firewalls
- Regular security updates
- Use secrets management service

## Backup and Recovery

### Database Backups
- Enable automated backups in cloud database service
- Test backup restoration procedures
- Consider point-in-time recovery

### Application Backups
- Version control for code
- Container image versioning
- Configuration backups

## Troubleshooting

### Common Issues
1. **Database connection errors:**
   - Check DATABASE_URL format
   - Verify database is running
   - Check network connectivity

2. **Static files not loading:**
   - Verify nginx configuration
   - Check file permissions
   - Ensure files are copied to container

3. **Performance issues:**
   - Check database query performance
   - Monitor application metrics
   - Consider adding caching

### Debugging
- Check application logs
- Use health check endpoint
- Monitor resource usage