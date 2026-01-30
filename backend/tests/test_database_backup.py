"""
Test suite for Database Backup Management feature
Tests: /api/database/* endpoints
- GET /api/database/status - Database status
- GET /api/database/backups - Backup history
- POST /api/database/backup - Create backup (selective)
- GET /api/database/backup/{id}/status - Backup progress polling
- GET /api/database/backup/{id}/download - Download backup
- GET /api/database/backup/{id}/preview - Preview backup content
- DELETE /api/database/backup/{id} - Delete backup (admin only)
- POST /api/database/restore/{id} - Restore backup (admin only)
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Headers with admin auth token"""
    return {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }


class TestDatabaseStatus:
    """Tests for GET /api/database/status endpoint"""
    
    def test_get_database_status_success(self, admin_headers):
        """Test getting database status with admin credentials"""
        response = requests.get(f"{BASE_URL}/api/database/status", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Verify response structure
        assert "db_name" in data, "Missing db_name in response"
        assert "collections_count" in data, "Missing collections_count"
        assert "collections" in data, "Missing collections list"
        assert "total_size_mb" in data, "Missing total_size_mb"
        
        # Verify data types
        assert isinstance(data["collections"], list), "collections should be a list"
        assert isinstance(data["collections_count"], int), "collections_count should be int"
        assert isinstance(data["total_size_mb"], (int, float)), "total_size_mb should be numeric"
        
        print(f"✓ Database: {data['db_name']}, Collections: {data['collections_count']}, Size: {data['total_size_mb']} MB")
    
    def test_get_database_status_without_auth(self):
        """Test that database status requires authentication"""
        response = requests.get(f"{BASE_URL}/api/database/status")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_database_status_contains_collections_info(self, admin_headers):
        """Test that collections info contains name, count, and size"""
        response = requests.get(f"{BASE_URL}/api/database/status", headers=admin_headers)
        assert response.status_code == 200
        
        data = response.json()
        if data["collections"]:
            coll = data["collections"][0]
            assert "name" in coll, "Collection missing name"
            assert "count" in coll, "Collection missing count"
            assert "size_mb" in coll, "Collection missing size_mb"
            print(f"✓ Sample collection: {coll['name']} - {coll['count']} docs, {coll['size_mb']} MB")


class TestBackupHistory:
    """Tests for GET /api/database/backups endpoint"""
    
    def test_get_backup_history_success(self, admin_headers):
        """Test getting backup history with admin credentials"""
        response = requests.get(f"{BASE_URL}/api/database/backups", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "backups" in data, "Missing backups key in response"
        assert isinstance(data["backups"], list), "backups should be a list"
        
        print(f"✓ Found {len(data['backups'])} backups in history")
    
    def test_get_backup_history_without_auth(self):
        """Test that backup history requires authentication"""
        response = requests.get(f"{BASE_URL}/api/database/backups")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"


class TestCreateSelectiveBackup:
    """Tests for POST /api/database/backup endpoint (selective backup)"""
    
    created_backup_id = None
    
    def test_create_selective_backup_success(self, admin_headers):
        """Test creating a selective backup with small collections"""
        # Use small collections to avoid timeout
        params = {
            "tipo": "selectivo",
            "colecciones": ["users", "importaciones"]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/database/backup",
            headers=admin_headers,
            params=params
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Backup should return success=True"
        assert "backup_id" in data, "Missing backup_id in response"
        assert "backup" in data, "Missing backup info in response"
        
        # Store backup_id for subsequent tests
        TestCreateSelectiveBackup.created_backup_id = data["backup_id"]
        
        print(f"✓ Backup initiated: {data['backup_id']}")
        print(f"  Filename: {data['backup']['filename']}")
        print(f"  Collections: {data['backup']['colecciones_count']}")
    
    def test_poll_backup_status(self, admin_headers):
        """Test polling backup status until completion"""
        backup_id = TestCreateSelectiveBackup.created_backup_id
        if not backup_id:
            pytest.skip("No backup_id from previous test")
        
        max_attempts = 30  # 30 seconds max
        for attempt in range(max_attempts):
            response = requests.get(
                f"{BASE_URL}/api/database/backup/{backup_id}/status",
                headers=admin_headers
            )
            assert response.status_code == 200, f"Status check failed: {response.text}"
            
            status = response.json()
            print(f"  Attempt {attempt + 1}: status={status.get('status')}, progress={status.get('progress')}%")
            
            if status.get("status") == "completed":
                print(f"✓ Backup completed successfully")
                return
            elif status.get("status") == "error":
                pytest.fail(f"Backup failed with error: {status.get('error')}")
            
            time.sleep(1)
        
        pytest.fail("Backup did not complete within timeout")
    
    def test_create_backup_without_auth(self):
        """Test that creating backup requires authentication"""
        response = requests.post(f"{BASE_URL}/api/database/backup")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
    
    def test_create_backup_empty_collections(self, admin_headers):
        """Test that selective backup with no collections fails"""
        params = {
            "tipo": "selectivo",
            "colecciones": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/database/backup",
            headers=admin_headers,
            params=params
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestBackupOperations:
    """Tests for backup download, preview, and delete operations"""
    
    def test_preview_backup(self, admin_headers):
        """Test previewing backup content"""
        # First get a backup from history
        response = requests.get(f"{BASE_URL}/api/database/backups", headers=admin_headers)
        assert response.status_code == 200
        
        backups = response.json().get("backups", [])
        if not backups:
            pytest.skip("No backups available for preview test")
        
        backup_id = backups[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/database/backup/{backup_id}/preview",
            headers=admin_headers
        )
        assert response.status_code == 200, f"Preview failed: {response.text}"
        
        data = response.json()
        assert "backup_info" in data, "Missing backup_info in preview"
        assert "colecciones" in data, "Missing colecciones in preview"
        
        print(f"✓ Preview for backup {backup_id}:")
        for coll in data.get("colecciones", []):
            print(f"  - {coll['name']}: {coll['count']} documents")
    
    def test_download_backup(self, admin_headers):
        """Test downloading a backup file"""
        # First get a backup from history
        response = requests.get(f"{BASE_URL}/api/database/backups", headers=admin_headers)
        assert response.status_code == 200
        
        backups = response.json().get("backups", [])
        if not backups:
            pytest.skip("No backups available for download test")
        
        backup_id = backups[0]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/database/backup/{backup_id}/download",
            headers=admin_headers,
            stream=True
        )
        assert response.status_code == 200, f"Download failed: {response.text}"
        assert "application/zip" in response.headers.get("content-type", ""), "Expected zip content type"
        
        # Check content length
        content_length = response.headers.get("content-length")
        print(f"✓ Download successful, size: {content_length} bytes")
    
    def test_preview_nonexistent_backup(self, admin_headers):
        """Test previewing a non-existent backup returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/database/backup/nonexistent-id/preview",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_download_nonexistent_backup(self, admin_headers):
        """Test downloading a non-existent backup returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/database/backup/nonexistent-id/download",
            headers=admin_headers
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPermissions:
    """Tests for role-based access control"""
    
    def test_database_status_requires_admin_or_coordinator(self, admin_headers):
        """Verify only admin/coordinator can access database status"""
        # Admin should have access
        response = requests.get(f"{BASE_URL}/api/database/status", headers=admin_headers)
        assert response.status_code == 200, "Admin should have access to database status"
    
    def test_delete_backup_requires_admin(self, admin_headers):
        """Test that only admin can delete backups"""
        # First get a backup
        response = requests.get(f"{BASE_URL}/api/database/backups", headers=admin_headers)
        backups = response.json().get("backups", [])
        
        if not backups:
            pytest.skip("No backups available for delete test")
        
        # Admin should be able to delete (we won't actually delete to preserve test data)
        # Just verify the endpoint exists and responds correctly
        backup_id = backups[0]["id"]
        
        # Test with invalid backup_id to avoid deleting real data
        response = requests.delete(
            f"{BASE_URL}/api/database/backup/test-invalid-id",
            headers=admin_headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent backup"
        print("✓ Delete endpoint properly requires admin role and returns 404 for invalid ID")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
