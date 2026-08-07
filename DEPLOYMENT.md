# Production Deployment Guide

## Environment Configuration

### 1. Environment Variables
Create a `.env.production` file with the following variables:

```bash
# Database Configuration
MONGODB_URI=mongodb://your-production-db-host:27017/student_erp_production
DB_NAME=student_erp_production

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here
JWT_EXPIRES_IN=24h
SESSION_SECRET=your-session-secret-key-here

# Email Configuration
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM=noreply@yourdomain.com

# File Upload
UPLOAD_PATH=/app/uploads
MAX_FILE_SIZE=10485760

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Application
NODE_ENV=production
PORT=3000
BASE_URL=https://yourdomain.com

# Payment Gateway (if applicable)
PAYMENT_GATEWAY_KEY=your-payment-gateway-key
PAYMENT_GATEWAY_SECRET=your-payment-gateway-secret

# SMS Service (if applicable)
SMS_API_KEY=your-sms-api-key
SMS_API_SECRET=your-sms-api-secret
```

### 2. Database Setup
```bash
# Create production database
mongoimport --uri="mongodb://your-production-db-host:27017/student_erp_production" --collection=users --file=./database/seeds/users.json
mongoimport --uri="mongodb://your-production-db-host:27017/student_erp_production" --collection=settings --file=./database/seeds/settings.json
```

### 3. SSL Certificate Configuration
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Deployment Steps

### 1. Server Preparation
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

### 2. Application Deployment
```bash
# Clone repository
git clone https://github.com/yourusername/student-erp.git
cd student-erp

# Install dependencies
npm install --production

# Copy environment file
cp .env.production .env

# Build frontend assets (if using build process)
npm run build

# Start application with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 3. PM2 Configuration
Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'student-erp',
    script: './backend/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### 4. Database Migration
```bash
# Run database migrations
node scripts/migrate.js

# Seed initial data
node scripts/seed.js
```

## Security Hardening

### 1. Firewall Configuration
```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw deny 3000
```

### 2. File Permissions
```bash
# Set proper file permissions
chmod -R 755 /path/to/student-erp
chmod -R 644 /path/to/student-erp/uploads
chown -R www-data:www-data /path/to/student-erp
```

### 3. Security Headers
Add to Nginx configuration:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## Monitoring and Logging

### 1. Application Monitoring
```bash
# Install monitoring tools
npm install -g pm2-logrotate
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### 2. System Monitoring
```bash
# Install system monitoring
sudo apt install htop iotop nethogs -y

# Setup log monitoring
sudo apt install logwatch -y
```

### 3. Application Health Check
Create `health-check.js`:
```javascript
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/health',
  method: 'GET',
  timeout: 5000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('✅ Application is healthy');
    process.exit(0);
  } else {
    console.log('❌ Application health check failed');
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.log('❌ Health check error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.log('❌ Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();
```

## Backup Strategy

### 1. Database Backup
```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups/mongodb"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="student_erp_production"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database backup
mongodump --uri="mongodb://your-production-db-host:27017/$DB_NAME" --out="$BACKUP_DIR/$TIMESTAMP"

# Compress backup
tar -czf "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "$TIMESTAMP"

# Remove uncompressed backup
rm -rf "$BACKUP_DIR/$TIMESTAMP"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Database backup completed: ${DB_NAME}_${TIMESTAMP}.tar.gz"
```

### 2. File Backup
```bash
#!/bin/bash
# backup-files.sh

BACKUP_DIR="/backups/files"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SOURCE_DIR="/path/to/student-erp/uploads"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create file backup
tar -czf "$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz" -C "$(dirname $SOURCE_DIR)" "$(basename $SOURCE_DIR)"

# Keep only last 30 days of file backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "File backup completed: uploads_${TIMESTAMP}.tar.gz"
```

### 3. Automated Backup Schedule
```bash
# Add to crontab (crontab -e)
# Daily database backup at 2 AM
0 2 * * * /path/to/backup-db.sh

# Weekly file backup on Sundays at 3 AM
0 3 * * 0 /path/to/backup-files.sh
```

## Performance Optimization

### 1. Database Optimization
```javascript
// Add database indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
db.admissions.createIndex({ studentId: 1 });
db.admissions.createIndex({ status: 1 });
db.fees.createIndex({ studentId: 1 });
db.fees.createIndex({ dueDate: 1 });
db.hostels.createIndex({ studentId: 1 });
db.library.createIndex({ userId: 1 });
db.library.createIndex({ returnDate: 1 });
db.courses.createIndex({ code: 1 }, { unique: true });
db.examinations.createIndex({ courseId: 1 });
db.attendance.createIndex({ studentId: 1, date: 1 });
db.notifications.createIndex({ userId: 1, read: 1 });
db.documents.createIndex({ userId: 1 });
db.documents.createIndex({ type: 1 });
```

### 2. Nginx Optimization
```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied expired no-cache no-store private must-revalidate auth;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;

# Enable caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Increase client body size
client_max_body_size 20M;

# Connection optimization
keepalive_timeout 65;
keepalive_requests 100;
```

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check MongoDB status
   sudo systemctl status mongod
   
   # Check connection
   mongo --eval "db.adminCommand('ismaster')"
   ```

2. **Application Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs student-erp
   
   # Check process status
   pm2 status
   ```

3. **High Memory Usage**
   ```bash
   # Monitor memory usage
   pm2 monit
   
   # Restart application
   pm2 restart student-erp
   ```

4. **File Upload Issues**
   ```bash
   # Check upload directory permissions
   ls -la /path/to/uploads
   
   # Fix permissions
   chown -R www-data:www-data /path/to/uploads
   chmod -R 755 /path/to/uploads
   ```

### Rollback Procedure
```bash
# Stop current application
pm2 stop student-erp

# Restore from backup
git checkout previous-stable-tag

# Restore database if needed
mongorestore --uri="mongodb://your-production-db-host:27017/student_erp_production" /path/to/backup

# Restart application
pm2 start student-erp
```

## Maintenance

### Regular Tasks
- **Daily**: Check application logs and system resources
- **Weekly**: Review security logs and update dependencies
- **Monthly**: Update system packages and review performance metrics
- **Quarterly**: Security audit and backup restore testing

### Updates
```bash
# Update application
git pull origin main
npm install --production
pm2 restart student-erp

# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js dependencies
npm audit fix
npm update
```

## Support and Documentation

### Contact Information
- **Technical Support**: tech-support@yourdomain.com
- **Emergency Contact**: +1-XXX-XXX-XXXX
- **Documentation**: https://docs.yourdomain.com

### Resources
- Application logs: `/path/to/student-erp/logs/`
- Database backups: `/backups/mongodb/`
- File backups: `/backups/files/`
- Configuration files: `/path/to/student-erp/.env`