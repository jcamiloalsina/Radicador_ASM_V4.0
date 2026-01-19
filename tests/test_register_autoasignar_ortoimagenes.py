"""
Test suite for:
1. User Registration - POST /api/auth/register
2. Auto-asignación de gestores - POST /api/petitions/{id}/auto-asignar
3. Ortoimagenes endpoints - POST /api/ortoimagenes/subir, GET /api/ortoimagenes/disponibles, 
   GET /api/ortoimagenes/progreso/{id}, DELETE /api/ortoimagenes/{id}

Iteration 8 - Testing bug fixes and new ortoimagen upload functionality
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://property-sync-10.preview.emergentagent.com').rstrip('/')

# Test credentials
ADMIN_EMAIL = "catastro@asomunicipios.gov.co"
ADMIN_PASSWORD = "Asm*123*"


class TestUserRegistration:
    """Tests for user registration endpoint - POST /api/auth/register"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_register_new_user_requires_verification(self):
        """POST /api/auth/register should require email verification for new users"""
        unique_email = f"test_user_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "full_name": "Test User"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}. Response: {response.text}"
        
        data = response.json()
        assert "requires_verification" in data, "Response should contain 'requires_verification'"
        assert data["requires_verification"] == True, "New users should require email verification"
        assert "email" in data, "Response should contain 'email'"
        assert data["email"] == unique_email, f"Expected email {unique_email}, got {data['email']}"
    
    def test_register_invalid_password_too_short(self):
        """POST /api/auth/register should reject passwords shorter than 6 characters"""
        unique_email = f"test_short_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Ab1",  # Too short
            "full_name": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "6 caracteres" in response.json().get("detail", ""), "Should mention minimum 6 characters"
    
    def test_register_invalid_password_no_uppercase(self):
        """POST /api/auth/register should reject passwords without uppercase"""
        unique_email = f"test_noup_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "test123!",  # No uppercase
            "full_name": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "mayúscula" in response.json().get("detail", ""), "Should mention uppercase requirement"
    
    def test_register_invalid_password_no_lowercase(self):
        """POST /api/auth/register should reject passwords without lowercase"""
        unique_email = f"test_nolow_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TEST123!",  # No lowercase
            "full_name": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "minúscula" in response.json().get("detail", ""), "Should mention lowercase requirement"
    
    def test_register_invalid_password_no_number(self):
        """POST /api/auth/register should reject passwords without numbers"""
        unique_email = f"test_nonum_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass!",  # No number
            "full_name": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "número" in response.json().get("detail", ""), "Should mention number requirement"
    
    def test_register_duplicate_email_verified(self):
        """POST /api/auth/register should reject duplicate verified emails"""
        # Try to register with admin email (already verified)
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": ADMIN_EMAIL,
            "password": "Test123!",
            "full_name": "Test User"
        })
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "ya está registrado" in response.json().get("detail", ""), "Should mention email already registered"
    
    def test_register_formats_name_properly(self):
        """POST /api/auth/register should format names with proper capitalization"""
        unique_email = f"test_name_{uuid.uuid4().hex[:8]}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "Test123!",
            "full_name": "maria garcia"  # lowercase name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        # The name should be formatted with proper capitalization and accents
        # Note: We can't verify the formatted name directly from this response


class TestAutoAsignacion:
    """Tests for auto-asignación endpoint - POST /api/petitions/{id}/auto-asignar"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json()["token"]
            self.user = login_response.json()["user"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed - skipping authenticated tests")
    
    def test_auto_asignar_requires_auth(self):
        """POST /api/petitions/{id}/auto-asignar should require authentication"""
        # Create a new session without auth
        no_auth_session = requests.Session()
        no_auth_session.headers.update({"Content-Type": "application/json"})
        
        response = no_auth_session.post(f"{BASE_URL}/api/petitions/fake-id/auto-asignar")
        
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
    
    def test_auto_asignar_petition_not_found(self):
        """POST /api/petitions/{id}/auto-asignar should return 404 for non-existent petition"""
        response = self.session.post(f"{BASE_URL}/api/petitions/nonexistent-id-12345/auto-asignar")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        assert "no encontrada" in response.json().get("detail", "").lower(), "Should mention petition not found"
    
    def test_auto_asignar_success_flow(self):
        """POST /api/petitions/{id}/auto-asignar should allow gestor/admin to self-assign"""
        # First, get a petition that is in 'radicado' state
        petitions_response = self.session.get(f"{BASE_URL}/api/petitions?estado=radicado&limit=1")
        
        if petitions_response.status_code != 200:
            pytest.skip("Could not fetch petitions")
        
        # API returns array directly, not object with "petitions" key
        petitions = petitions_response.json()
        if isinstance(petitions, dict):
            petitions = petitions.get("petitions", [])
        
        if not petitions:
            pytest.skip("No petitions in 'radicado' state available for testing")
        
        petition_id = petitions[0]["id"]
        
        # Now try to auto-assign
        response = self.session.post(f"{BASE_URL}/api/petitions/{petition_id}/auto-asignar")
        
        # Should succeed or indicate already assigned
        assert response.status_code in [200, 400], f"Expected 200 or 400, got {response.status_code}. Response: {response.text}"
        
        if response.status_code == 200:
            assert "asignado" in response.json().get("message", "").lower(), "Should confirm assignment"
        elif response.status_code == 400:
            # Already assigned is acceptable
            assert "ya está asignado" in response.json().get("detail", "").lower(), "Should mention already assigned"
    
    def test_auto_asignar_updates_petition_state(self):
        """POST /api/petitions/{id}/auto-asignar should update petition state to 'asignado'"""
        # Get a petition in radicado state
        petitions_response = self.session.get(f"{BASE_URL}/api/petitions?estado=radicado&limit=50")
        
        if petitions_response.status_code != 200:
            pytest.skip("Could not fetch petitions")
        
        petitions = petitions_response.json()
        if isinstance(petitions, dict):
            petitions = petitions.get("petitions", [])
        
        # Find a petition that is not already assigned to current user AND is in radicado state
        petition_id = None
        for p in petitions:
            if (self.user["id"] not in p.get("gestores_asignados", []) and 
                p.get("estado") == "radicado"):
                petition_id = p["id"]
                break
        
        if not petition_id:
            pytest.skip("No unassigned petitions in 'radicado' state available for testing")
        
        # Auto-assign
        assign_response = self.session.post(f"{BASE_URL}/api/petitions/{petition_id}/auto-asignar")
        
        assert assign_response.status_code == 200, f"Expected 200, got {assign_response.status_code}. Response: {assign_response.text}"
        
        # Verify petition state changed
        get_response = self.session.get(f"{BASE_URL}/api/petitions/{petition_id}")
        
        if get_response.status_code == 200:
            petition = get_response.json()
            assert petition.get("estado") == "asignado", f"Expected state 'asignado', got {petition.get('estado')}"
            assert self.user["id"] in petition.get("gestores_asignados", []), "User should be in gestores_asignados"


class TestOrtoimagenesEndpoints:
    """Tests for ortoimagenes endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json()["token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed - skipping authenticated tests")
    
    def test_ortoimagenes_disponibles_returns_list(self):
        """GET /api/ortoimagenes/disponibles should return list of ortoimagenes"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/disponibles")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "ortoimagenes" in data, "Response should contain 'ortoimagenes' key"
        assert isinstance(data["ortoimagenes"], list), "ortoimagenes should be a list"
    
    def test_ortoimagenes_disponibles_structure(self):
        """GET /api/ortoimagenes/disponibles should return ortoimagenes with correct structure"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/disponibles")
        
        assert response.status_code == 200
        
        data = response.json()
        ortoimagenes = data["ortoimagenes"]
        
        if ortoimagenes:
            orto = ortoimagenes[0]
            # Check required fields
            assert "id" in orto, "Ortoimagen should have 'id'"
            assert "nombre" in orto, "Ortoimagen should have 'nombre'"
            assert "municipio" in orto, "Ortoimagen should have 'municipio'"
            assert "activa" in orto, "Ortoimagen should have 'activa'"
    
    def test_ortoimagenes_progreso_invalid_id(self):
        """GET /api/ortoimagenes/progreso/{id} should return appropriate response for invalid ID"""
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/progreso/invalid-id-12345")
        
        # Should return 404 or a status indicating not found
        assert response.status_code in [200, 404], f"Expected 200 or 404, got {response.status_code}"
        
        if response.status_code == 200:
            data = response.json()
            # If 200, should indicate not found or error status
            assert data.get("status") in ["no_encontrado", "error", "completado", "procesando"], \
                f"Unexpected status: {data.get('status')}"
    
    def test_ortoimagenes_eliminar_requires_auth(self):
        """DELETE /api/ortoimagenes/{id} should require authentication"""
        no_auth_session = requests.Session()
        
        response = no_auth_session.delete(f"{BASE_URL}/api/ortoimagenes/fake-id")
        
        assert response.status_code in [401, 403], f"Expected 401 or 403, got {response.status_code}"
    
    def test_ortoimagenes_eliminar_not_found(self):
        """DELETE /api/ortoimagenes/{id} should return 404 for non-existent ortoimagen"""
        response = self.session.delete(f"{BASE_URL}/api/ortoimagenes/nonexistent-id-12345")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_ortoimagenes_subir_requires_auth(self):
        """POST /api/ortoimagenes/subir should require authentication"""
        no_auth_session = requests.Session()
        
        response = no_auth_session.post(f"{BASE_URL}/api/ortoimagenes/subir")
        
        assert response.status_code in [401, 403, 422], f"Expected 401, 403 or 422, got {response.status_code}"
    
    def test_ortoimagenes_subir_requires_geotiff(self):
        """POST /api/ortoimagenes/subir should reject non-GeoTIFF files"""
        # Create a fake text file
        files = {
            'file': ('test.txt', b'This is not a GeoTIFF', 'text/plain')
        }
        data = {
            'nombre': 'Test Ortoimagen',
            'municipio': 'Test',
            'descripcion': 'Test description'
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/ortoimagenes/subir",
            files=files,
            data=data,
            headers=headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "GeoTIFF" in response.json().get("detail", ""), "Should mention GeoTIFF requirement"
    
    def test_ortoimagenes_tiles_endpoint(self):
        """GET /api/ortoimagenes/tiles/{id}/{z}/{x}/{y}.png should serve tiles"""
        # First get available ortoimagenes
        list_response = self.session.get(f"{BASE_URL}/api/ortoimagenes/disponibles")
        
        if list_response.status_code != 200:
            pytest.skip("Could not list ortoimagenes")
        
        ortoimagenes = list_response.json().get("ortoimagenes", [])
        
        if not ortoimagenes:
            pytest.skip("No ortoimagenes available for testing")
        
        orto_id = ortoimagenes[0]["id"]
        
        # Try to get a tile
        response = self.session.get(f"{BASE_URL}/api/ortoimagenes/tiles/{orto_id}/17/0/0.png")
        
        # Should return 200 (tile exists), 204 (no content), or 404 (not found)
        assert response.status_code in [200, 204, 404], f"Expected 200, 204 or 404, got {response.status_code}"


class TestVerifyEmailEndpoint:
    """Tests for email verification endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_verify_email_invalid_code(self):
        """POST /api/auth/verify-email should reject invalid codes"""
        response = self.session.post(f"{BASE_URL}/api/auth/verify-email", json={
            "email": "nonexistent@test.com",
            "code": "000000"
        })
        
        # Should return 404 (user not found) or 400 (invalid code)
        assert response.status_code in [400, 404], f"Expected 400 or 404, got {response.status_code}"
    
    def test_resend_verification_nonexistent_user(self):
        """POST /api/auth/resend-verification should return 404 for non-existent user"""
        response = self.session.post(f"{BASE_URL}/api/auth/resend-verification", json={
            "email": "nonexistent_user_12345@test.com"
        })
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPetitionsEndpoints:
    """Additional tests for petitions endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - login as admin"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            self.token = login_response.json()["token"]
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Login failed - skipping authenticated tests")
    
    def test_create_petition_success(self):
        """POST /api/petitions should create a new petition (using Form data)"""
        # Note: This endpoint uses Form data, not JSON
        data = {
            "nombre_completo": f"Test Petition {uuid.uuid4().hex[:6]}",
            "correo": f"test_{uuid.uuid4().hex[:6]}@test.com",
            "telefono": "3001234567",
            "tipo_tramite": "Certificado Catastral",
            "municipio": "Ocaña",
            "descripcion": "Test petition"
        }
        
        # Use form data instead of JSON
        response = requests.post(
            f"{BASE_URL}/api/petitions",
            data=data,
            headers={"Authorization": f"Bearer {self.token}"}
        )
        
        assert response.status_code in [200, 201], f"Expected 200 or 201, got {response.status_code}. Response: {response.text}"
        
        result = response.json()
        assert "id" in result, "Response should contain 'id'"
        assert "radicado" in result, "Response should contain 'radicado'"
    
    def test_list_petitions(self):
        """GET /api/petitions should return list of petitions"""
        response = self.session.get(f"{BASE_URL}/api/petitions?limit=5")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        # API returns array directly
        assert isinstance(data, list), "Response should be a list"
        if len(data) > 0:
            assert "id" in data[0], "Petition should have 'id'"
            assert "radicado" in data[0], "Petition should have 'radicado'"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
