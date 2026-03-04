"""
Tests for Resolution Configuration API endpoints
Testing the configuration and numbering system for resolution PDFs.

Endpoints tested:
- GET /api/resoluciones/configuracion - Get current numbering configuration
- PUT /api/resoluciones/configuracion - Update numbering configuration
- GET /api/resoluciones/siguiente-numero/{municipio} - Get next resolution number
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


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
def coordinador_auth_header():
    """Get coordinador authentication header"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "Camilo.alsina1@hotmail.com",
        "password": "Asm*123*"
    })
    if response.status_code != 200:
        pytest.skip(f"Coordinador login failed: {response.text}")
    token = response.json().get("token")
    return {"Authorization": f"Bearer {token}"}


class TestConfiguracionEndpoints:
    """Test GET and PUT /api/resoluciones/configuracion endpoints"""
    
    def test_get_configuracion_success(self, admin_auth_header):
        """Verify admin can get configuration"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header
        )
        assert response.status_code == 200, f"Get config failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "configuracion" in data
        config = data["configuracion"]
        assert "ultimo_numero_2026" in config
        print(f"✓ Configuration retrieved - ultimo_numero_2026: {config.get('ultimo_numero_2026')}")
    
    def test_get_configuracion_denied_unauthenticated(self):
        """Verify unauthenticated request is denied"""
        response = requests.get(f"{BASE_URL}/api/resoluciones/configuracion")
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print("✓ Unauthenticated request correctly rejected")
    
    def test_get_configuracion_denied_coordinador(self, coordinador_auth_header):
        """Verify coordinador cannot access configuration (admin only)"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=coordinador_auth_header
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Coordinador correctly denied access to configuration")
    
    def test_put_configuracion_success(self, admin_auth_header):
        """Verify admin can update configuration"""
        # First get current value
        get_response = requests.get(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header
        )
        original_value = get_response.json()["configuracion"].get("ultimo_numero_2026", 0)
        
        # Update with new value
        new_value = 50  # Current expected value
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header,
            json={"ultimo_numero_2026": new_value}
        )
        assert response.status_code == 200, f"Update failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Configuration updated - nuevo valor: {new_value}")
        
        # Verify update was persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header
        )
        assert verify_response.json()["configuracion"]["ultimo_numero_2026"] == new_value
        print("✓ Configuration update persisted in database")
    
    def test_put_configuracion_denied_coordinador(self, coordinador_auth_header):
        """Verify coordinador cannot update configuration"""
        response = requests.put(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=coordinador_auth_header,
            json={"ultimo_numero_2026": 999}
        )
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print("✓ Coordinador correctly denied update access")


class TestSiguienteNumeroEndpoint:
    """Test GET /api/resoluciones/siguiente-numero/{municipio} endpoint"""
    
    def test_siguiente_numero_abrego(self, admin_auth_header):
        """Test getting next resolution number for Ábrego"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/siguiente-numero/Ábrego",
            headers=admin_auth_header
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        assert "siguiente_numero" in data
        assert "numero_resolucion" in data
        # Should contain RES-54003 for Ábrego
        assert "54003" in data["numero_resolucion"] or "54-003" in data["numero_resolucion"]
        print(f"✓ Siguiente número Ábrego: {data['numero_resolucion']} (#{data['siguiente_numero']})")
    
    def test_siguiente_numero_ocana(self, admin_auth_header):
        """Test getting next resolution number for Ocaña"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/siguiente-numero/Ocaña",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        assert "54498" in data["numero_resolucion"] or "54-498" in data["numero_resolucion"]
        print(f"✓ Siguiente número Ocaña: {data['numero_resolucion']}")
    
    def test_siguiente_numero_convencion(self, admin_auth_header):
        """Test getting next resolution number for Convención"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/siguiente-numero/Convención",
            headers=admin_auth_header
        )
        assert response.status_code == 200
        data = response.json()
        assert "54206" in data["numero_resolucion"] or "54-206" in data["numero_resolucion"]
        print(f"✓ Siguiente número Convención: {data['numero_resolucion']}")


class TestIntegration:
    """Integration tests for the full configuration flow"""
    
    def test_full_configuration_flow(self, admin_auth_header):
        """Test complete flow: get config -> update -> get next number -> verify"""
        # Step 1: Get current config
        config_response = requests.get(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header
        )
        assert config_response.status_code == 200
        current_config = config_response.json()["configuracion"]
        current_ultimo = current_config.get("ultimo_numero_2026", 0)
        print(f"Step 1: Current ultimo_numero_2026 = {current_ultimo}")
        
        # Step 2: Update to test value
        test_value = 50
        update_response = requests.put(
            f"{BASE_URL}/api/resoluciones/configuracion",
            headers=admin_auth_header,
            json={"ultimo_numero_2026": test_value}
        )
        assert update_response.status_code == 200
        print(f"Step 2: Updated to {test_value}")
        
        # Step 3: Get next number - should be test_value + 1
        next_response = requests.get(
            f"{BASE_URL}/api/resoluciones/siguiente-numero/Ábrego",
            headers=admin_auth_header
        )
        assert next_response.status_code == 200
        next_data = next_response.json()
        expected_next = test_value + 1
        print(f"Step 3: Next number = {next_data['siguiente_numero']} (expected {expected_next})")
        
        # The formula is: numero_inicial + count + 1
        # If count is 0 (no resolutions yet), next should be test_value + 1
        # If there are existing resolutions, it will be higher
        assert next_data["siguiente_numero"] >= expected_next
        print(f"✓ Full configuration flow working correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
