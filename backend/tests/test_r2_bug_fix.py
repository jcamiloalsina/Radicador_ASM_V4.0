"""
Test for R2 data bug fix - verifying that when editing R2 (area terreno) data,
the detail view (eye icon) shows updated data correctly.

Bug: Frontend sends data as 'r2' but detail view reads from 'r2_registros'.
Fix: Backend converts 'r2' to 'r2_registros' when applying changes (server.py lines 11057-11064).
"""
import pytest
import requests
import os
import time
import random

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestR2BugFix:
    """Test R2 data conversion bug fix"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as admin
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        })
        
        if login_response.status_code != 200:
            pytest.skip(f"Login failed: {login_response.text}")
        
        token = login_response.json().get("token")
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        self.user = login_response.json().get("user")
        print(f"Logged in as: {self.user.get('email')} - Role: {self.user.get('role')}")
    
    def test_login_success(self):
        """Test that login works"""
        assert self.user is not None
        assert self.user.get('role') == 'administrador'
        print("✓ Login successful as administrador")
    
    def test_get_predios_list(self):
        """Test getting predios list for Ábrego municipality"""
        response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "limit": 10
        })
        
        assert response.status_code == 200, f"Failed to get predios: {response.text}"
        data = response.json()
        
        print(f"✓ Got {len(data.get('predios', []))} predios from Ábrego")
        print(f"  Total predios in municipality: {data.get('total', 0)}")
        
        assert len(data.get('predios', [])) > 0, "Should have at least one predio"
    
    def test_r2_bug_fix_conversion(self):
        """
        MAIN TEST: Verify that R2 data sent as 'r2' is correctly converted to 'r2_registros'
        
        This test verifies the bug fix at server.py lines 11057-11064:
        - Frontend sends R2 data as 'r2' field
        - Backend converts it to 'r2_registros' format
        - Detail view reads from 'r2_registros' and shows correct data
        """
        # Get a predio to modify
        predios_response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "limit": 10
        })
        
        assert predios_response.status_code == 200
        predios = predios_response.json().get('predios', [])
        
        if not predios:
            pytest.skip("No predios found in Ábrego")
        
        # Use a random predio to avoid test conflicts
        predio = random.choice(predios)
        predio_id = predio.get('id')
        codigo = predio.get('codigo_predial_nacional')
        
        print(f"Testing R2 modification on predio: {codigo}")
        
        # Generate unique test value
        test_area_terreno = round(random.uniform(10000, 99999), 2)
        
        # Build the update payload as frontend sends it (with 'r2' field)
        update_payload = {
            "predio_id": predio_id,
            "tipo_cambio": "modificacion",
            "datos_propuestos": {
                "nombre_propietario": predio.get('nombre_propietario', 'Test Owner'),
                "tipo_documento": predio.get('tipo_documento', 'C'),
                "numero_documento": predio.get('numero_documento', '12345678'),
                "direccion": predio.get('direccion', 'Test Address'),
                "destino_economico": predio.get('destino_economico', 'A'),
                "area_terreno": predio.get('area_terreno', 100),
                "area_construida": predio.get('area_construida', 0),
                "avaluo": predio.get('avaluo', 1000000),
                # R2 data as frontend sends it (key field for bug fix)
                "r2": {
                    "matricula_inmobiliaria": predio.get('r2_registros', [{}])[0].get('matricula_inmobiliaria', '') if predio.get('r2_registros') else '',
                    "zonas": [{
                        "zona_fisica": "1",
                        "zona_economica": "1",
                        "area_terreno": test_area_terreno,  # Test value
                        "habitaciones": 2,
                        "banos": 1,
                        "locales": 0,
                        "pisos": 1,
                        "puntaje": 50,
                        "area_construida": 80
                    }]
                }
            },
            "justificacion": f"Test R2 bug fix - area_terreno={test_area_terreno}"
        }
        
        print(f"  Sending r2 data with area_terreno: {test_area_terreno}")
        
        # Propose/apply the change
        response = self.session.post(f"{BASE_URL}/api/predios/cambios/proponer", json=update_payload)
        
        print(f"  Response status: {response.status_code}")
        
        assert response.status_code == 200, f"Failed to apply change: {response.text}"
        
        result = response.json()
        print(f"✓ Change applied: {result.get('mensaje', 'OK')}")
        
        # Wait for DB update
        time.sleep(1)
        
        # Verify the predio was updated with r2_registros (not r2)
        verify_response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "search": codigo,
            "limit": 1
        })
        
        assert verify_response.status_code == 200
        updated_predios = verify_response.json().get('predios', [])
        
        assert len(updated_predios) > 0, "Should find the updated predio"
        
        updated_predio = updated_predios[0]
        
        # KEY ASSERTION: r2_registros should exist (not r2)
        r2_registros = updated_predio.get('r2_registros', [])
        print(f"\n  Verification - r2_registros present: {bool(r2_registros)}")
        
        assert len(r2_registros) > 0, "r2_registros should not be empty after update"
        
        r2 = r2_registros[0]
        zonas = r2.get('zonas', [])
        print(f"  Verification - zonas count: {len(zonas)}")
        
        assert len(zonas) > 0, "zonas should not be empty"
        
        actual_area = zonas[0].get('area_terreno')
        print(f"  Verification - area_terreno: {actual_area}")
        
        # This is the key assertion - the bug fix ensures r2_registros contains the updated data
        assert actual_area == test_area_terreno, \
            f"Expected area_terreno {test_area_terreno}, got {actual_area}"
        
        print(f"\n✓ BUG FIX VERIFIED: r2_registros correctly contains updated area_terreno!")
        print(f"  - Frontend sent data as 'r2'")
        print(f"  - Backend converted to 'r2_registros'")
        print(f"  - Detail view will show correct data from r2_registros")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
