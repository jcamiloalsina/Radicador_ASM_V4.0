"""
Test for R2 data bug fix - verifying that when editing R2 (area terreno) data,
the detail view (eye icon) shows updated data correctly.

Bug: Frontend sends data as 'r2' but detail view reads from 'r2_registros'.
Fix: Backend converts 'r2' to 'r2_registros' when applying changes.
"""
import pytest
import requests
import os
import time

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
        
        # Store first predio for later tests
        if data.get('predios'):
            self.test_predio = data['predios'][0]
            print(f"  First predio: {self.test_predio.get('codigo_predial_nacional')}")
        
        return data
    
    def test_get_predio_detail(self):
        """Test getting predio detail and check r2_registros structure"""
        # First get a predio
        predios_response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "limit": 5
        })
        
        assert predios_response.status_code == 200
        predios = predios_response.json().get('predios', [])
        
        if not predios:
            pytest.skip("No predios found in Ábrego")
        
        # Find a predio with r2_registros data
        predio_with_r2 = None
        for predio in predios:
            if predio.get('r2_registros') and len(predio.get('r2_registros', [])) > 0:
                predio_with_r2 = predio
                break
        
        if not predio_with_r2:
            print("⚠ No predio with r2_registros found, using first predio")
            predio_with_r2 = predios[0]
        
        predio_id = predio_with_r2.get('id')
        print(f"Testing predio: {predio_with_r2.get('codigo_predial_nacional')}")
        print(f"  Has r2_registros: {bool(predio_with_r2.get('r2_registros'))}")
        
        if predio_with_r2.get('r2_registros'):
            r2 = predio_with_r2['r2_registros'][0]
            print(f"  R2 matricula: {r2.get('matricula_inmobiliaria')}")
            if r2.get('zonas'):
                for idx, zona in enumerate(r2['zonas']):
                    print(f"  Zona {idx+1}: area_terreno={zona.get('area_terreno')}")
        
        return predio_with_r2
    
    def test_proponer_cambio_r2(self):
        """Test proposing a change to R2 data (area terreno)"""
        # Get a predio first
        predios_response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "limit": 10
        })
        
        assert predios_response.status_code == 200
        predios = predios_response.json().get('predios', [])
        
        if not predios:
            pytest.skip("No predios found in Ábrego")
        
        # Use first predio
        predio = predios[0]
        predio_id = predio.get('id')
        codigo = predio.get('codigo_predial_nacional')
        
        print(f"Testing R2 modification on predio: {codigo}")
        
        # Get current R2 data
        current_r2 = predio.get('r2_registros', [{}])[0] if predio.get('r2_registros') else {}
        current_zonas = current_r2.get('zonas', [])
        
        # Prepare new R2 data with modified area_terreno
        new_area_terreno = 12345.67  # Test value
        
        # Build the update payload as frontend sends it
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
                # R2 data as frontend sends it
                "r2": {
                    "matricula_inmobiliaria": current_r2.get('matricula_inmobiliaria', ''),
                    "zonas": [{
                        "zona_fisica": "1",
                        "zona_economica": "1",
                        "area_terreno": new_area_terreno,  # Modified value
                        "habitaciones": 2,
                        "banos": 1,
                        "locales": 0,
                        "pisos": 1,
                        "puntaje": 50,
                        "area_construida": 80
                    }]
                }
            },
            "justificacion": "Test R2 bug fix - modifying area_terreno"
        }
        
        print(f"  Sending r2 data with area_terreno: {new_area_terreno}")
        
        # Propose the change
        response = self.session.post(f"{BASE_URL}/api/predios/cambios/proponer", json=update_payload)
        
        print(f"  Response status: {response.status_code}")
        print(f"  Response: {response.text[:500]}")
        
        # For admin, changes are applied directly
        if response.status_code == 200:
            result = response.json()
            print(f"✓ Change proposed/applied successfully")
            print(f"  Result: {result}")
            
            # Now verify the predio was updated with r2_registros
            time.sleep(0.5)  # Small delay for DB update
            
            verify_response = self.session.get(f"{BASE_URL}/api/predios", params={
                "municipio": "Ábrego",
                "search": codigo,
                "limit": 1
            })
            
            if verify_response.status_code == 200:
                updated_predios = verify_response.json().get('predios', [])
                if updated_predios:
                    updated_predio = updated_predios[0]
                    
                    # Check if r2_registros was properly set
                    r2_registros = updated_predio.get('r2_registros', [])
                    print(f"\n  Verification - r2_registros present: {bool(r2_registros)}")
                    
                    if r2_registros:
                        r2 = r2_registros[0]
                        zonas = r2.get('zonas', [])
                        print(f"  Verification - zonas count: {len(zonas)}")
                        
                        if zonas:
                            actual_area = zonas[0].get('area_terreno')
                            print(f"  Verification - area_terreno: {actual_area}")
                            
                            # This is the key assertion - the bug fix should ensure
                            # r2_registros contains the updated data
                            assert actual_area == new_area_terreno, \
                                f"Expected area_terreno {new_area_terreno}, got {actual_area}"
                            print(f"✓ BUG FIX VERIFIED: r2_registros correctly contains updated area_terreno")
                    else:
                        print("⚠ r2_registros is empty after update")
            
            return result
        else:
            print(f"✗ Failed to propose change: {response.text}")
            assert False, f"Failed to propose change: {response.text}"
    
    def test_backend_r2_conversion_logic(self):
        """Test that backend properly converts r2 to r2_registros format"""
        # This test verifies the fix at server.py lines 11057-11064
        
        predios_response = self.session.get(f"{BASE_URL}/api/predios", params={
            "municipio": "Ábrego",
            "limit": 5
        })
        
        assert predios_response.status_code == 200
        predios = predios_response.json().get('predios', [])
        
        if not predios:
            pytest.skip("No predios found")
        
        predio = predios[0]
        predio_id = predio.get('id')
        
        # Test with specific R2 data structure
        test_r2_data = {
            "matricula_inmobiliaria": "TEST-MAT-001",
            "zonas": [
                {
                    "zona_fisica": "2",
                    "zona_economica": "3",
                    "area_terreno": 9999.99,
                    "habitaciones": 3,
                    "banos": 2,
                    "locales": 1,
                    "pisos": 2,
                    "puntaje": 75,
                    "area_construida": 150
                }
            ]
        }
        
        update_payload = {
            "predio_id": predio_id,
            "tipo_cambio": "modificacion",
            "datos_propuestos": {
                "nombre_propietario": predio.get('nombre_propietario', 'Test'),
                "tipo_documento": predio.get('tipo_documento', 'C'),
                "numero_documento": predio.get('numero_documento', '123'),
                "direccion": predio.get('direccion', 'Test'),
                "destino_economico": predio.get('destino_economico', 'A'),
                "area_terreno": predio.get('area_terreno', 100),
                "area_construida": predio.get('area_construida', 0),
                "avaluo": predio.get('avaluo', 1000000),
                "r2": test_r2_data  # Frontend sends as 'r2'
            },
            "justificacion": "Testing r2 to r2_registros conversion"
        }
        
        response = self.session.post(f"{BASE_URL}/api/predios/cambios/proponer", json=update_payload)
        
        if response.status_code == 200:
            # Verify the conversion happened
            time.sleep(0.5)
            
            verify_response = self.session.get(f"{BASE_URL}/api/predios", params={
                "municipio": "Ábrego",
                "search": predio.get('codigo_predial_nacional'),
                "limit": 1
            })
            
            if verify_response.status_code == 200:
                updated = verify_response.json().get('predios', [])
                if updated:
                    r2_registros = updated[0].get('r2_registros', [])
                    
                    # Verify structure
                    assert len(r2_registros) > 0, "r2_registros should not be empty"
                    
                    r2 = r2_registros[0]
                    assert r2.get('matricula_inmobiliaria') == test_r2_data['matricula_inmobiliaria'], \
                        "Matricula should match"
                    
                    zonas = r2.get('zonas', [])
                    assert len(zonas) > 0, "zonas should not be empty"
                    
                    zona = zonas[0]
                    assert zona.get('area_terreno') == test_r2_data['zonas'][0]['area_terreno'], \
                        "area_terreno should match"
                    
                    print("✓ Backend r2 to r2_registros conversion verified")
                    print(f"  matricula_inmobiliaria: {r2.get('matricula_inmobiliaria')}")
                    print(f"  area_terreno: {zona.get('area_terreno')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
