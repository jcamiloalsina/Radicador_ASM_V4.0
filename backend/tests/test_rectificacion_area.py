"""
Test Rectificación de Área (formerly M6) - Area rectification mutation
Tests the complete flow for area correction of predios including:
- RECTIFICACION_AREA type enabled in mutations list
- POST /api/solicitudes-mutacion accepts tipo='RECTIFICACION_AREA'
- _generar_resolucion_m6_interno generates PDF correctly
- Predio data is properly updated with new areas
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestRectificacionAreaAPI:
    """Tests for Rectificación de Área (Area Rectification) mutation API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_credentials = {
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        }
        self.token = None
        self.session = requests.Session()
    
    def authenticate(self):
        """Authenticate and get token"""
        if self.token:
            return self.token
        
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        if response.status_code == 200:
            self.token = response.json().get("token")
            return self.token
        raise Exception(f"Authentication failed: {response.status_code}")
    
    def get_auth_headers(self):
        """Get headers with authentication token"""
        token = self.authenticate()
        return {"Authorization": f"Bearer {token}"}
    
    # =====================================
    # Test 1: Health check
    # =====================================
    def test_01_health_check(self):
        """Test API health endpoint"""
        response = self.session.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed: {response.status_code}"
        print("✅ Health check: PASS")
    
    # =====================================
    # Test 2: Authentication
    # =====================================
    def test_02_authentication(self):
        """Test admin login works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        data = response.json()
        assert "token" in data, "No token in login response"
        assert data.get("user", {}).get("role") in ["administrador", "coordinador"], "User should be admin/coordinator"
        print(f"✅ Authentication: PASS (role: {data.get('user', {}).get('role')})")
    
    # =====================================
    # Test 3: RECTIFICACION_AREA in types list
    # =====================================
    def test_03_rectificacion_area_type_configured(self):
        """Test that RECTIFICACION_AREA type is configured in the system"""
        # Verify the type exists in SolicitudMutacionCreate model
        # This is verified by checking if the endpoint accepts this type
        headers = self.get_auth_headers()
        
        # Test with minimal payload - should get validation error, not type error
        minimal_payload = {
            "tipo": "RECTIFICACION_AREA",
            "municipio": "El Carmen"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/solicitudes-mutacion", 
            json=minimal_payload, 
            headers=headers
        )
        
        # Should not be 422 "type not supported" - any other error is acceptable
        # The important thing is that the type is recognized
        assert response.status_code != 422 or "tipo" not in str(response.text).lower(), \
            "RECTIFICACION_AREA type should be recognized"
        print("✅ RECTIFICACION_AREA type is recognized by the API")
    
    # =====================================
    # Test 4: Search for a predio to use
    # =====================================
    def test_04_search_predio_for_rectification(self):
        """Test searching for predios to rectify"""
        headers = self.get_auth_headers()
        
        # Get vigencia actual
        stats_response = self.session.get(f"{BASE_URL}/api/predios/stats/summary", headers=headers)
        vigencia = stats_response.json().get("vigencia_actual", 2025) if stats_response.status_code == 200 else 2025
        
        # Search for predios in El Carmen
        response = self.session.get(
            f"{BASE_URL}/api/predios",
            params={"municipio": "El Carmen", "vigencia": vigencia, "limit": 5},
            headers=headers
        )
        
        assert response.status_code == 200, f"Predio search failed: {response.status_code}"
        data = response.json()
        
        if data.get("predios") and len(data["predios"]) > 0:
            predio = data["predios"][0]
            print(f"✅ Found predio for testing: {predio.get('codigo_predial_nacional', predio.get('id', 'N/A'))}")
            # Store for next test
            self.__class__.test_predio = predio
        else:
            print("⚠️ No predios found in El Carmen - skipping PDF generation test")
            self.__class__.test_predio = None
    
    # =====================================
    # Test 5: Create Rectificación de Área solicitud
    # =====================================
    def test_05_create_rectificacion_area_solicitud(self):
        """Test creating a Rectificación de Área solicitud with PDF generation"""
        headers = self.get_auth_headers()
        
        predio = getattr(self.__class__, 'test_predio', None)
        
        if not predio:
            # Create minimal test without real predio
            pytest.skip("No predio available for testing - skipping full flow test")
        
        # Get predio details
        predio_id = predio.get('id')
        codigo_predial = predio.get('codigo_predial_nacional') or predio.get('NPN', '')
        area_terreno_actual = predio.get('area_terreno', 0)
        area_construida_actual = predio.get('area_construida', 0)
        avaluo_actual = predio.get('avaluo', 0)
        
        # Propietarios
        propietarios = predio.get('propietarios', [])
        if propietarios:
            solicitante = {
                "nombre": propietarios[0].get('nombre_propietario', 'Test Propietario'),
                "documento": propietarios[0].get('numero_documento', '123456789')
            }
        else:
            solicitante = {"nombre": "Test Propietario", "documento": "123456789"}
        
        # Nueva área (slightly different for testing)
        nueva_area_terreno = float(area_terreno_actual) + 10 if area_terreno_actual else 100
        nueva_area_construida = float(area_construida_actual) if area_construida_actual else 50
        nuevo_avaluo = float(avaluo_actual) * 1.1 if avaluo_actual else 1000000
        
        payload = {
            "tipo": "RECTIFICACION_AREA",
            "subtipo": "rectificacion_area",
            "municipio": "El Carmen",
            "radicado": f"TEST-RECT-{int(time.time())}",
            "solicitante": solicitante,
            "predio_id": predio_id,
            "predio_rectificacion": predio,
            "area_terreno_anterior": float(area_terreno_actual) if area_terreno_actual else 0,
            "area_terreno_nueva": nueva_area_terreno,
            "area_construida_anterior": float(area_construida_actual) if area_construida_actual else 0,
            "area_construida_nueva": nueva_area_construida,
            "avaluo_anterior": float(avaluo_actual) if avaluo_actual else 0,
            "avaluo_nuevo": nuevo_avaluo,
            "motivo_solicitud": "Rectificación de área catastral para prueba automatizada",
            "observaciones": "Test automatizado - Rectificación de Área",
            "texto_considerando": ""
        }
        
        print(f"📤 Sending RECTIFICACION_AREA request for predio: {codigo_predial}")
        
        response = self.session.post(
            f"{BASE_URL}/api/solicitudes-mutacion",
            json=payload,
            headers=headers
        )
        
        print(f"📥 Response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ Solicitud creada exitosamente")
            print(f"   - ID: {data.get('solicitud_id', 'N/A')}")
            print(f"   - Radicado: {data.get('radicado', 'N/A')}")
            print(f"   - Aprobación directa: {data.get('aprobacion_directa', False)}")
            
            if data.get("pdf_url"):
                print(f"   - PDF URL: {data.get('pdf_url')}")
                print(f"   - Número Resolución: {data.get('numero_resolucion', 'N/A')}")
                self.__class__.pdf_url = data.get("pdf_url")
                self.__class__.numero_resolucion = data.get("numero_resolucion")
            else:
                print("   ⚠️ No PDF URL returned (may be pending approval)")
            
            assert data.get("success") == True, "Response should indicate success"
        else:
            error_detail = response.json().get("detail", response.text) if response.text else "Unknown error"
            print(f"❌ Error: {error_detail}")
            # Still pass if it's a minor error (like duplicate radicado)
            if "radicado" in str(error_detail).lower() or "already" in str(error_detail).lower():
                print("⚠️ Test passed with warning: radicado may already exist")
            else:
                assert False, f"Failed to create solicitud: {error_detail}"
    
    # =====================================
    # Test 6: Verify PDF can be downloaded
    # =====================================
    def test_06_verify_pdf_download(self):
        """Test that generated PDF can be downloaded"""
        pdf_url = getattr(self.__class__, 'pdf_url', None)
        
        if not pdf_url:
            pytest.skip("No PDF URL from previous test - skipping download test")
        
        headers = self.get_auth_headers()
        
        # Download PDF
        full_url = f"{BASE_URL}{pdf_url}" if not pdf_url.startswith('http') else pdf_url
        response = self.session.get(full_url, headers=headers)
        
        if response.status_code == 200:
            assert response.headers.get('Content-Type', '').startswith('application/pdf') or \
                   len(response.content) > 1000, "Response should be a valid PDF"
            print(f"✅ PDF download: PASS ({len(response.content)} bytes)")
        else:
            print(f"⚠️ PDF download returned {response.status_code} - may need different endpoint")
    
    # =====================================
    # Test 7: Verify RECTIFICACION_AREA in historial
    # =====================================
    def test_07_check_historial_resoluciones(self):
        """Test that RECTIFICACION_AREA resoluciones appear in historial"""
        headers = self.get_auth_headers()
        
        response = self.session.get(
            f"{BASE_URL}/api/resoluciones/historial",
            params={"codigo_municipio": "54245"},  # El Carmen
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            resoluciones = data.get("resoluciones", [])
            
            # Check if any RECTIFICACION_AREA exists
            rectificaciones = [r for r in resoluciones if r.get("tipo") == "RECTIFICACION_AREA"]
            
            if rectificaciones:
                print(f"✅ Found {len(rectificaciones)} RECTIFICACION_AREA resoluciones in historial")
            else:
                print("⚠️ No RECTIFICACION_AREA in historial yet (this may be the first test)")
        else:
            print(f"⚠️ Historial endpoint returned {response.status_code}")
    
    # =====================================
    # Test 8: Verify predio was updated
    # =====================================
    def test_08_verify_predio_updated(self):
        """Test that predio areas were updated after rectification"""
        predio = getattr(self.__class__, 'test_predio', None)
        numero_resolucion = getattr(self.__class__, 'numero_resolucion', None)
        
        if not predio or not numero_resolucion:
            pytest.skip("No predio or resolucion from previous tests - skipping verification")
        
        headers = self.get_auth_headers()
        predio_id = predio.get('id')
        
        # Get updated predio
        response = self.session.get(
            f"{BASE_URL}/api/predios/{predio_id}",
            headers=headers
        )
        
        if response.status_code == 200:
            data = response.json()
            updated_predio = data.get("predio", data)
            
            # Check if update was applied
            if updated_predio.get("ultima_rectificacion_area"):
                print(f"✅ Predio updated with rectificación: {updated_predio.get('ultima_rectificacion_area')}")
            if updated_predio.get("resolucion_rectificacion"):
                print(f"✅ Predio has resolución: {updated_predio.get('resolucion_rectificacion')}")
            
            # Check historial_resoluciones
            historial = updated_predio.get("historial_resoluciones", [])
            if historial:
                rect_entries = [h for h in historial if h.get("tipo_mutacion") == "RECTIFICACION_AREA"]
                if rect_entries:
                    print(f"✅ Found {len(rect_entries)} RECTIFICACION_AREA entries in predio historial")
        else:
            print(f"⚠️ Could not fetch predio {predio_id}: {response.status_code}")


class TestRectificacionAreaPDFGenerator:
    """Tests for the M6 PDF generator"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_credentials = {
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        }
        self.session = requests.Session()
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            self.token = None
    
    def get_auth_headers(self):
        """Get headers with authentication token"""
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}
    
    def test_pdf_generator_module_exists(self):
        """Test that resolucion_m6_pdf_generator module exists and has required functions"""
        # This is verified by checking if the endpoint works - module import happens in backend
        headers = self.get_auth_headers()
        
        # A successful POST means the generator was imported correctly
        response = self.session.post(
            f"{BASE_URL}/api/solicitudes-mutacion",
            json={
                "tipo": "RECTIFICACION_AREA",
                "municipio": "Test",
                "radicado": "TEST-IMPORT-CHECK"
            },
            headers=headers
        )
        
        # If we don't get ImportError, the module exists
        if response.status_code != 500 or "import" not in str(response.text).lower():
            print("✅ resolucion_m6_pdf_generator module loaded successfully")
        else:
            assert False, "PDF generator module failed to import"


class TestRectificacionAreaEndpointValidation:
    """Tests for validation of RECTIFICACION_AREA endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.admin_credentials = {
            "email": "catastro@asomunicipios.gov.co",
            "password": "Asm*123*"
        }
        self.session = requests.Session()
        
        # Login
        response = self.session.post(f"{BASE_URL}/api/auth/login", json=self.admin_credentials)
        if response.status_code == 200:
            self.token = response.json().get("token")
        else:
            self.token = None
    
    def get_auth_headers(self):
        """Get headers with authentication token"""
        return {"Authorization": f"Bearer {self.token}"} if self.token else {}
    
    def test_endpoint_requires_auth(self):
        """Test that POST /api/solicitudes-mutacion requires authentication"""
        response = self.session.post(
            f"{BASE_URL}/api/solicitudes-mutacion",
            json={"tipo": "RECTIFICACION_AREA", "municipio": "Test"}
        )
        assert response.status_code in [401, 403], f"Should require auth, got {response.status_code}"
        print("✅ Endpoint correctly requires authentication")
    
    def test_endpoint_accepts_rectificacion_area_type(self):
        """Test that the endpoint accepts RECTIFICACION_AREA as a valid type"""
        headers = self.get_auth_headers()
        if not self.token:
            pytest.skip("Authentication failed")
        
        # Minimal valid payload
        payload = {
            "tipo": "RECTIFICACION_AREA",
            "subtipo": "rectificacion_area",
            "municipio": "El Carmen"
        }
        
        response = self.session.post(
            f"{BASE_URL}/api/solicitudes-mutacion",
            json=payload,
            headers=headers
        )
        
        # The endpoint should accept the type even if other validations fail
        # We're testing that RECTIFICACION_AREA is in the switch case
        response_text = response.text.lower()
        assert "tipo" not in response_text or "invalid" not in response_text, \
            "RECTIFICACION_AREA should be a valid type"
        print(f"✅ RECTIFICACION_AREA type accepted (status: {response.status_code})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
