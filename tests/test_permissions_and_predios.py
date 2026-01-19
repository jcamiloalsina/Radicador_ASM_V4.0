"""
Test suite for Permissions System and Predios Filter
Tests:
- GET /api/permissions/available - List available permissions
- GET /api/permissions/users - List users with permissions
- PATCH /api/permissions/user - Update user permissions
- GET /api/predios?tiene_geometria=false - Filter predios without geometry
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://cadastral-update.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"
TEST_GESTOR_ID = "ed122558-835c-4a8a-bb3d-d2b33a7d013f"


@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, f"Admin login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    """Get authorization headers"""
    return {"Authorization": f"Bearer {admin_token}"}


class TestPermissionsAvailable:
    """Tests for GET /api/permissions/available endpoint"""
    
    def test_get_available_permissions_success(self, auth_headers):
        """Test that available permissions endpoint returns 3 permissions"""
        response = requests.get(
            f"{BASE_URL}/api/permissions/available",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "permissions" in data
        permissions = data["permissions"]
        
        # Verify 3 permissions exist
        assert len(permissions) == 3, f"Expected 3 permissions, got {len(permissions)}"
        
        # Verify permission keys
        permission_keys = [p["key"] for p in permissions]
        assert "upload_gdb" in permission_keys
        assert "import_r1r2" in permission_keys
        assert "approve_changes" in permission_keys
        
        # Verify each permission has description
        for perm in permissions:
            assert "key" in perm
            assert "description" in perm
            assert len(perm["description"]) > 0
    
    def test_get_available_permissions_unauthorized(self):
        """Test that endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/permissions/available")
        assert response.status_code in [401, 403]


class TestPermissionsUsers:
    """Tests for GET /api/permissions/users endpoint"""
    
    def test_get_users_with_permissions(self, auth_headers):
        """Test that users with permissions are returned"""
        response = requests.get(
            f"{BASE_URL}/api/permissions/users",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "users" in data
        users = data["users"]
        
        # Verify users list is returned
        assert isinstance(users, list)
        
        # Verify user structure
        for user in users:
            assert "id" in user
            assert "email" in user
            assert "full_name" in user
            assert "role" in user
            # Verify role is gestor, gestor_auxiliar, or coordinador
            assert user["role"] in ["gestor", "gestor_auxiliar", "coordinador"]
    
    def test_users_have_permissions_detail(self, auth_headers):
        """Test that users have permissions_detail field"""
        response = requests.get(
            f"{BASE_URL}/api/permissions/users",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        for user in data["users"]:
            assert "permissions_detail" in user
            # permissions_detail should be a list
            assert isinstance(user["permissions_detail"], list)


class TestUpdateUserPermissions:
    """Tests for PATCH /api/permissions/user endpoint"""
    
    def test_update_user_permissions_success(self, auth_headers):
        """Test updating user permissions"""
        # Update permissions
        response = requests.patch(
            f"{BASE_URL}/api/permissions/user",
            headers=auth_headers,
            json={
                "user_id": TEST_GESTOR_ID,
                "permissions": ["upload_gdb", "import_r1r2", "approve_changes"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response
        assert "message" in data
        assert "user_id" in data
        assert "permissions" in data
        assert data["user_id"] == TEST_GESTOR_ID
        assert len(data["permissions"]) == 3
    
    def test_verify_permissions_updated(self, auth_headers):
        """Test that permissions were actually updated"""
        response = requests.get(
            f"{BASE_URL}/api/permissions/user/{TEST_GESTOR_ID}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "permissions" in data
        assert "upload_gdb" in data["permissions"]
        assert "import_r1r2" in data["permissions"]
        assert "approve_changes" in data["permissions"]
    
    def test_update_with_invalid_permission(self, auth_headers):
        """Test that invalid permissions are rejected"""
        response = requests.patch(
            f"{BASE_URL}/api/permissions/user",
            headers=auth_headers,
            json={
                "user_id": TEST_GESTOR_ID,
                "permissions": ["invalid_permission"]
            }
        )
        
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
    
    def test_update_nonexistent_user(self, auth_headers):
        """Test updating permissions for non-existent user"""
        response = requests.patch(
            f"{BASE_URL}/api/permissions/user",
            headers=auth_headers,
            json={
                "user_id": "nonexistent-user-id",
                "permissions": ["upload_gdb"]
            }
        )
        
        assert response.status_code == 404


class TestPrediosTieneGeometriaFilter:
    """Tests for GET /api/predios with tiene_geometria filter"""
    
    def test_filter_predios_sin_geometria(self, auth_headers):
        """Test filtering predios without geometry (tiene_geometria=false)"""
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=auth_headers,
            params={"tiene_geometria": "false", "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "predios" in data
        
        # Verify total is greater than 0
        assert data["total"] > 0, "Expected predios without geometry"
        
        # Verify predios returned
        assert len(data["predios"]) > 0
        
        # Verify predios don't have tiene_geometria=True
        for predio in data["predios"]:
            assert predio.get("tiene_geometria") != True, f"Predio {predio.get('id')} has tiene_geometria=True"
    
    def test_filter_predios_con_geometria(self, auth_headers):
        """Test filtering predios with geometry (tiene_geometria=true)"""
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=auth_headers,
            params={"tiene_geometria": "true", "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "predios" in data
        
        # Verify total is greater than 0
        assert data["total"] > 0, "Expected predios with geometry"
        
        # Verify predios have tiene_geometria=True
        for predio in data["predios"]:
            assert predio.get("tiene_geometria") == True, f"Predio {predio.get('id')} doesn't have tiene_geometria=True"
    
    def test_combined_filter_geometria_and_search(self, auth_headers):
        """Test combining tiene_geometria filter with search"""
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=auth_headers,
            params={"tiene_geometria": "false", "search": "San", "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "predios" in data
        
        # Verify results are returned
        assert data["total"] >= 0
    
    def test_combined_filter_geometria_and_municipio(self, auth_headers):
        """Test combining tiene_geometria filter with municipio"""
        response = requests.get(
            f"{BASE_URL}/api/predios",
            headers=auth_headers,
            params={"tiene_geometria": "false", "municipio": "San Calixto", "limit": 10}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "total" in data
        assert "predios" in data
        
        # Verify municipio filter works
        for predio in data["predios"]:
            assert predio.get("municipio") == "San Calixto"


class TestPermissionsAccessControl:
    """Tests for permissions access control"""
    
    def test_ciudadano_cannot_access_permissions(self):
        """Test that ciudadano role cannot access permissions endpoints"""
        # First register a ciudadano user
        import uuid
        test_email = f"test_ciudadano_{uuid.uuid4().hex[:8]}@test.com"
        
        # Register
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": test_email,
                "password": "Test123!",
                "full_name": "Test Ciudadano"
            }
        )
        
        if response.status_code == 200:
            token = response.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access permissions
            response = requests.get(
                f"{BASE_URL}/api/permissions/available",
                headers=headers
            )
            
            assert response.status_code == 403, "Ciudadano should not access permissions"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
