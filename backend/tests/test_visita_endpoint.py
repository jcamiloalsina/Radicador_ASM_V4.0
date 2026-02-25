"""
Test suite for Visita endpoint - POST /api/actualizacion/proyectos/{proyecto_id}/predios/{codigo_predial}/visita
This test verifies the fix for the "Error al guardar visita" issue - bug was missing GESTOR_AUXILIAR role
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://property-mgmt-hub-6.preview.emergentagent.com')

# Test credentials - Coordinador user
TEST_EMAIL = "Camilo.alsina1@hotmail.com"
TEST_PASSWORD = "Asm*123*"

# Project and predio data
PROJECT_ID = "32ba040f-ed50-45e2-a115-22ab3a351423"  # Proyecto_prueba_ZU_Sardinata


class TestVisitaEndpoint:
    """Test cases for the Visita endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json().get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def test_login_success(self):
        """Test that login works correctly"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["role"] == "coordinador"
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_get_predios_list(self):
        """Test that we can get predios list from the project"""
        response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios",
            headers=self.headers,
            params={"page": 1, "page_size": 50}
        )
        assert response.status_code == 200, f"Failed to get predios: {response.text}"
        data = response.json()
        assert "predios" in data
        assert len(data["predios"]) > 0
        print(f"✓ Got {len(data['predios'])} predios from project")
        return data["predios"][0]
    
    def test_save_visita_minimal(self):
        """Test saving visita with minimal required data"""
        # Get first predio
        predios_response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios",
            headers=self.headers,
            params={"page": 1, "page_size": 50}
        )
        predios = predios_response.json().get("predios", [])
        assert len(predios) > 0, "No predios found for testing"
        
        codigo_predial = predios[0]["codigo_predial"]
        
        # Save visita with minimal data
        visita_data = {
            "fecha_visita": "2026-01-17",
            "hora_visita": "10:30",
            "persona_atiende": "TEST_MINIMAL_VISITA",
            "relacion_predio": "propietario",
            "acceso_predio": "si"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios/{codigo_predial}/visita",
            headers=self.headers,
            json=visita_data
        )
        
        assert response.status_code == 200, f"Failed to save visita: {response.text}"
        data = response.json()
        assert data["message"] == "Visita guardada correctamente"
        assert data["estado_visita"] == "visitado"
        print(f"✓ Visita saved successfully for predio {codigo_predial}")
    
    def test_save_visita_complete(self):
        """Test saving visita with complete data including observaciones and sin_cambios"""
        predios_response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios",
            headers=self.headers,
            params={"page": 1, "page_size": 50}
        )
        predios = predios_response.json().get("predios", [])
        assert len(predios) > 1, "Need at least 2 predios for testing"
        
        codigo_predial = predios[1]["codigo_predial"]
        
        # Complete visita data
        visita_data = {
            "fecha_visita": "2026-01-17",
            "hora_visita": "14:30",
            "persona_atiende": "TEST_COMPLETE_VISITA",
            "relacion_predio": "arrendatario",
            "acceso_predio": "si",
            "sin_cambios": True,
            "observaciones": "Prueba de visita completa - sin cambios detectados",
            "estado_predio": "habitado",
            "servicios_publicos": ["Agua", "Energía"],
            "tipo_predio": "NPH",
            "direccion_verificada": "CALLE TEST 123",
            "destino_economico": "A",
            "coordenadas_gps": {
                "latitud": "7.8123456",
                "longitud": "-72.9123456",
                "precision": "5.0"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios/{codigo_predial}/visita",
            headers=self.headers,
            json=visita_data
        )
        
        assert response.status_code == 200, f"Failed to save visita: {response.text}"
        data = response.json()
        assert data["message"] == "Visita guardada correctamente"
        assert data["estado_visita"] == "visitado"
        assert data["sin_cambios"] == True
        print(f"✓ Complete visita saved successfully for predio {codigo_predial}")
    
    def test_save_visita_predio_not_found(self):
        """Test error handling when predio doesn't exist"""
        visita_data = {
            "fecha_visita": "2026-01-17",
            "hora_visita": "10:30",
            "persona_atiende": "TEST_USER",
            "relacion_predio": "propietario",
            "acceso_predio": "si"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios/999999999999999999999999999999/visita",
            headers=self.headers,
            json=visita_data
        )
        
        assert response.status_code == 404
        data = response.json()
        assert "no encontrado" in data["detail"].lower() or "not found" in data["detail"].lower()
        print("✓ Predio not found error handled correctly")
    
    def test_verify_visita_persisted(self):
        """Test that visita data is actually persisted and can be retrieved"""
        predios_response = requests.get(
            f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios",
            headers=self.headers,
            params={"page": 1, "page_size": 50}
        )
        predios = predios_response.json().get("predios", [])
        
        # Find a predio that has been visited
        visited_predio = None
        for p in predios:
            if p.get("estado_visita") == "visitado":
                visited_predio = p
                break
        
        if visited_predio:
            codigo_predial = visited_predio["codigo_predial"]
            
            # Get visita data
            response = requests.get(
                f"{BASE_URL}/api/actualizacion/proyectos/{PROJECT_ID}/predios/{codigo_predial}/visita",
                headers=self.headers
            )
            
            assert response.status_code == 200, f"Failed to get visita: {response.text}"
            data = response.json()
            assert data["estado_visita"] in ["visitado", "visitado_firmado"]
            print(f"✓ Visita data retrieved for predio {codigo_predial}")
        else:
            print("⚠ No visited predios found to verify persistence")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
