"""
Tests for Resolution Templates (Plantillas de Resolución) API endpoints
Testing the new template management system for generating resolution PDFs (type M1).

Endpoints tested:
- GET /api/resoluciones/plantillas - List available templates
- GET /api/resoluciones/plantillas/M1 - Get specific M1 template
- PUT /api/resoluciones/plantillas/M1 - Update M1 template text
- POST /api/resoluciones/generar-preview?tipo=M1 - Generate PDF preview
"""
import pytest
import requests
import os
import base64
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestAuthentication:
    """Test authentication for resolution templates"""
    
    def test_admin_login_success(self):
        """Verify admin can login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token returned"
        user = data.get("user", {})
        assert user.get("role") == "administrador", f"Expected administrador role, got {user.get('role')}"
        print(f"✓ Admin login successful - role: {user.get('role')}")


@pytest.fixture(scope="class")
def admin_auth_header():
    """Get admin authentication header"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "catastro@asomunicipios.gov.co",
        "password": "Asm*123*"
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.text}")
    token = response.json().get("token")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="class")
def gestor_auth_header():
    """Get gestor (non-admin) authentication header for access control tests"""
    # First try to find/use an existing gestor user
    # If gestor doesn't exist, we'll skip those tests
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test_gestor@test.com",
        "password": "Test*123"
    })
    if response.status_code == 200:
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    return None


class TestAccessControl:
    """Test role-based access control for resolution templates"""
    
    def test_unauthenticated_request_denied(self):
        """Verify unauthenticated requests are rejected"""
        response = requests.get(f"{BASE_URL}/api/resoluciones/plantillas")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated requests correctly rejected")
    
    def test_admin_can_access_plantillas(self, admin_auth_header):
        """Verify admin can access the templates list"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas",
            headers=admin_auth_header
        )
        assert response.status_code == 200, f"Admin access denied: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ Admin can access plantillas list")


class TestListarPlantillas:
    """Test GET /api/resoluciones/plantillas endpoint"""
    
    def test_list_plantillas_returns_array(self, admin_auth_header):
        """Verify the endpoint returns a list of templates"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "plantillas" in data
        assert isinstance(data["plantillas"], list)
        print(f"✓ Plantillas list returned with {len(data['plantillas'])} templates")
    
    def test_list_plantillas_contains_m1(self, admin_auth_header):
        """Verify M1 template exists in the list"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        
        plantillas = data.get("plantillas", [])
        tipos = [p.get("tipo") for p in plantillas]
        assert "M1" in tipos, f"M1 template not found in {tipos}"
        
        # Verify M1 structure
        m1 = next((p for p in plantillas if p.get("tipo") == "M1"), None)
        assert m1 is not None
        assert "nombre" in m1
        assert "texto" in m1
        print(f"✓ M1 template found: {m1.get('nombre')}")
    
    def test_list_plantillas_no_mongodb_id(self, admin_auth_header):
        """Verify MongoDB _id is not exposed in response"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        
        for plantilla in data.get("plantillas", []):
            assert "_id" not in plantilla, "MongoDB _id should not be exposed"
        print("✓ MongoDB _id correctly excluded from response")


class TestObtenerPlantillaM1:
    """Test GET /api/resoluciones/plantillas/M1 endpoint"""
    
    def test_get_m1_plantilla(self, admin_auth_header):
        """Verify getting M1 template by type"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "plantilla" in data
        
        plantilla = data["plantilla"]
        assert plantilla.get("tipo") == "M1"
        assert "texto" in plantilla
        assert len(plantilla["texto"]) > 0, "Template text should not be empty"
        print(f"✓ M1 template retrieved successfully - text length: {len(plantilla['texto'])}")
    
    def test_get_m1_plantilla_lowercase(self, admin_auth_header):
        """Verify endpoint handles lowercase 'm1'"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/m1",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert data["plantilla"]["tipo"] == "M1"
        print("✓ Lowercase 'm1' handled correctly")
    
    def test_get_nonexistent_plantilla(self, admin_auth_header):
        """Verify 404 for non-existent template type"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/XYZ",
            headers=admin_auth_header
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent template returns 404")
    
    def test_m1_plantilla_structure(self, admin_auth_header):
        """Verify M1 template has all required fields"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        plantilla = response.json()["plantilla"]
        
        required_fields = ["tipo", "nombre", "texto"]
        for field in required_fields:
            assert field in plantilla, f"Missing required field: {field}"
        
        # Check optional but expected fields
        expected_fields = ["descripcion", "firmante_nombre", "firmante_cargo"]
        for field in expected_fields:
            if field in plantilla:
                print(f"  - {field}: {plantilla[field][:50] if len(str(plantilla[field])) > 50 else plantilla[field]}")
        
        print(f"✓ M1 template has all required fields")


class TestActualizarPlantillaM1:
    """Test PUT /api/resoluciones/plantillas/M1 endpoint"""
    
    @pytest.fixture(autouse=True)
    def save_original_text(self, admin_auth_header):
        """Save original template text before tests and restore after"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        if response.status_code == 200:
            self.original_texto = response.json()["plantilla"].get("texto", "")
            self.original_firmante_nombre = response.json()["plantilla"].get("firmante_nombre", "")
            self.original_firmante_cargo = response.json()["plantilla"].get("firmante_cargo", "")
        else:
            self.original_texto = ""
            self.original_firmante_nombre = ""
            self.original_firmante_cargo = ""
        
        yield
        
        # Restore original text after test
        if self.original_texto:
            requests.put(
                f"{BASE_URL}/api/resoluciones/plantillas/M1",
                headers=admin_auth_header,
                json={
                    "texto": self.original_texto,
                    "firmante_nombre": self.original_firmante_nombre,
                    "firmante_cargo": self.original_firmante_cargo
                }
            )
    
    def test_update_m1_texto(self, admin_auth_header):
        """Verify updating M1 template text"""
        new_texto = f"TEST_TEXTO_ACTUALIZADO_{datetime.now().isoformat()}"
        
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header,
            json={
                "texto": new_texto,
                "firmante_nombre": "NOMBRE TEST",
                "firmante_cargo": "CARGO TEST"
            }
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print("✓ M1 template text update request successful")
        
        # Verify the update was persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        assert verify_response.status_code == 200
        updated_plantilla = verify_response.json()["plantilla"]
        assert new_texto in updated_plantilla["texto"], "Text update not persisted"
        print("✓ M1 template text update verified in database")
    
    def test_update_m1_firmante(self, admin_auth_header):
        """Verify updating firmante name and cargo"""
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header,
            json={
                "texto": "Texto de prueba",
                "firmante_nombre": "NOMBRE PRUEBA TEST",
                "firmante_cargo": "CARGO PRUEBA TEST"
            }
        )
        assert response.status_code == 200
        
        # Verify
        verify_response = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        plantilla = verify_response.json()["plantilla"]
        assert plantilla.get("firmante_nombre") == "NOMBRE PRUEBA TEST"
        assert plantilla.get("firmante_cargo") == "CARGO PRUEBA TEST"
        print("✓ Firmante name and cargo updated successfully")


class TestGenerarPreviewPDF:
    """Test POST /api/resoluciones/generar-preview endpoint"""
    
    def test_generate_preview_m1(self, admin_auth_header):
        """Verify PDF preview generation for M1"""
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/generar-preview?tipo=M1",
            headers=admin_auth_header,
            json={}
        )
        assert response.status_code == 200, f"Preview generation failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "pdf_base64" in data, "PDF base64 not returned"
        
        # Verify it's valid base64
        try:
            pdf_bytes = base64.b64decode(data["pdf_base64"])
            assert len(pdf_bytes) > 0, "PDF is empty"
            # Check PDF magic bytes
            assert pdf_bytes[:4] == b'%PDF', "Invalid PDF format"
            print(f"✓ Preview PDF generated successfully - size: {len(pdf_bytes)} bytes")
        except Exception as e:
            pytest.fail(f"Failed to decode PDF base64: {e}")
    
    def test_generate_preview_lowercase_tipo(self, admin_auth_header):
        """Verify lowercase 'm1' works"""
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/generar-preview?tipo=m1",
            headers=admin_auth_header,
            json={}
        )
        assert response.status_code == 200
        print("✓ Lowercase 'm1' type handled correctly")
    
    def test_generate_preview_invalid_tipo(self, admin_auth_header):
        """Verify invalid type returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/generar-preview?tipo=INVALID",
            headers=admin_auth_header,
            json={}
        )
        assert response.status_code == 404
        print("✓ Invalid type returns 404")
    
    def test_preview_includes_metadata(self, admin_auth_header):
        """Verify preview response includes metadata"""
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/generar-preview?tipo=M1",
            headers=admin_auth_header,
            json={}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check metadata fields
        assert "tipo_plantilla" in data, "tipo_plantilla not in response"
        assert data["tipo_plantilla"] == "M1"
        print(f"✓ Preview includes metadata - tipo: {data.get('tipo_plantilla')}, predio: {data.get('predio_usado', 'N/A')}")


class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_texto_update(self, admin_auth_header):
        """Test updating with empty text"""
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header,
            json={
                "texto": "",
                "firmante_nombre": "Test",
                "firmante_cargo": "Test"
            }
        )
        # Should either accept empty or return validation error
        assert response.status_code in [200, 400, 422], f"Unexpected status: {response.status_code}"
        print(f"✓ Empty text handled - status: {response.status_code}")
    
    def test_special_characters_in_texto(self, admin_auth_header):
        """Test template text with special characters"""
        texto_especial = "Texto con caracteres: áéíóú ñ ü © ® ™ € £ ¥"
        
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header,
            json={
                "texto": texto_especial,
                "firmante_nombre": "Test Ñoño",
                "firmante_cargo": "Coordinación"
            }
        )
        assert response.status_code == 200
        
        # Verify persistence
        verify = requests.get(
            f"{BASE_URL}/api/resoluciones/plantillas/M1",
            headers=admin_auth_header
        )
        assert texto_especial in verify.json()["plantilla"]["texto"]
        print("✓ Special characters handled correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
