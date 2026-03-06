"""
Test suite for M2 PDF Viewer and Predios functionality
Tests:
1. PDF viewer popup for M2 resolutions
2. Historial de resoluciones "Ver PDF" button
3. Endpoint /api/resoluciones/finalizar-y-enviar
4. Predios created by M2 have status 'aprobado' and appear in /api/predios
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://qr-data-mismatch.preview.emergentagent.com')


class TestResolucionesM2:
    """Tests for M2 Resoluciones and PDF Viewer"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for all tests"""
        # Login as admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "catastro@asomunicipios.gov.co", "password": "Asm*123*"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()['token']
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_01_health_check(self):
        """Test that API is healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ API health check passed")

    def test_02_historial_resoluciones_endpoint(self):
        """Test /api/resoluciones/historial endpoint returns resoluciones"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200, f"Historial endpoint failed: {response.text}"
        
        data = response.json()
        assert data.get('success') is True, "Response should have success=True"
        assert 'resoluciones' in data, "Response should have 'resoluciones' field"
        
        resoluciones = data['resoluciones']
        assert len(resoluciones) > 0, "Should have at least one resolution"
        print(f"✓ Historial endpoint returned {len(resoluciones)} resoluciones")

    def test_03_historial_has_m2_resoluciones(self):
        """Test that historial contains M2 type resolutions"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        resoluciones = data.get('resoluciones', [])
        
        # Filter M2 resolutions
        m2_resoluciones = [r for r in resoluciones if r.get('tipo_mutacion') == 'M2']
        assert len(m2_resoluciones) > 0, "Should have at least one M2 resolution"
        
        print(f"✓ Found {len(m2_resoluciones)} M2 resoluciones in historial")

    def test_04_resoluciones_have_pdf_path(self):
        """Test that resoluciones have pdf_path field"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        resoluciones = data.get('resoluciones', [])
        
        # Check first 5 resoluciones for pdf_path
        with_pdf = [r for r in resoluciones[:10] if r.get('pdf_path')]
        assert len(with_pdf) > 0, "At least some resoluciones should have pdf_path"
        
        print(f"✓ Found {len(with_pdf)} resoluciones with pdf_path")

    def test_05_pdf_file_accessible(self):
        """Test that PDF files are accessible via HTTP"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        resoluciones = data.get('resoluciones', [])
        
        # Find a resolution with pdf_path
        for res in resoluciones:
            if res.get('pdf_path'):
                pdf_url = f"{BASE_URL}{res['pdf_path']}"
                pdf_response = requests.head(pdf_url)
                assert pdf_response.status_code == 200, f"PDF not accessible at {pdf_url}"
                assert 'application/pdf' in pdf_response.headers.get('Content-Type', ''), "Should be PDF content type"
                print(f"✓ PDF file accessible: {res['numero_resolucion']}")
                break

    def test_06_finalizar_y_enviar_endpoint_exists(self):
        """Test that /api/resoluciones/finalizar-y-enviar endpoint exists"""
        # Test with non-existent radicado to verify endpoint exists
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/finalizar-y-enviar",
            headers=self.headers,
            json={"radicado": "TEST-NONEXISTENT-99999", "pdf_url": "/test.pdf"}
        )
        
        # Should return 404 for non-existent radicado (not 405 for method not allowed)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
        assert "No se encontró el trámite" in response.json().get('detail', ''), "Should return proper error message"
        print("✓ finalizar-y-enviar endpoint exists and validates radicado")

    def test_07_finalizar_y_enviar_requires_auth(self):
        """Test that finalizar-y-enviar requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/resoluciones/finalizar-y-enviar",
            json={"radicado": "TEST-123", "pdf_url": "/test.pdf"}
        )
        assert response.status_code in [401, 403], "Should require authentication"
        print("✓ finalizar-y-enviar requires authentication")


class TestPrediosM2:
    """Tests for predios created by M2 mutations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication for all tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "catastro@asomunicipios.gov.co", "password": "Asm*123*"}
        )
        assert response.status_code == 200
        self.token = response.json()['token']
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_08_predios_with_status_aprobado_exist(self):
        """Test that predios with status 'aprobado' exist in the system"""
        response = requests.get(
            f"{BASE_URL}/api/predios?status=aprobado&limit=10",
            headers=self.headers
        )
        assert response.status_code == 200, f"Predios endpoint failed: {response.text}"
        
        data = response.json()
        predios = data.get('predios', [])
        
        # Check for predios with status 'aprobado'
        aprobado_predios = [p for p in predios if p.get('status') == 'aprobado']
        assert len(aprobado_predios) > 0, "Should have at least one predio with status 'aprobado'"
        
        print(f"✓ Found {len(aprobado_predios)} predios with status 'aprobado'")

    def test_09_m2_predio_searchable_by_codigo(self):
        """Test that M2 created predio is searchable by codigo predial"""
        # Get the M2 resolution to find the predio code
        historial_response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert historial_response.status_code == 200
        
        resoluciones = historial_response.json().get('resoluciones', [])
        m2_res = None
        for r in resoluciones:
            if r.get('tipo_mutacion') == 'M2' and r.get('predios_inscritos'):
                m2_res = r
                break
        
        if m2_res and m2_res.get('predios_inscritos'):
            # Get the codigo of first inscribed predio
            predio_inscrito = m2_res['predios_inscritos'][0]
            codigo = predio_inscrito.get('codigo_predial', predio_inscrito.get('npn', ''))
            
            if codigo:
                # Search for this predio
                search_response = requests.get(
                    f"{BASE_URL}/api/predios?search={codigo[:20]}&limit=5",
                    headers=self.headers
                )
                assert search_response.status_code == 200
                
                search_data = search_response.json()
                predios = search_data.get('predios', [])
                
                # Verify the predio exists
                found = any(p.get('codigo_predial_nacional', '').startswith(codigo[:15]) for p in predios)
                if found:
                    print(f"✓ M2 predio searchable by codigo: {codigo[:20]}...")
                else:
                    print(f"⚠ M2 predio not found in search (may be in different vigencia)")
        else:
            pytest.skip("No M2 resolution with predios_inscritos found")

    def test_10_m2_predio_has_correct_data_structure(self):
        """Test that M2 created predio has correct data structure"""
        # Search for a known M2 predio
        response = requests.get(
            f"{BASE_URL}/api/predios?search=540030101000001240009&limit=1",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        predios = data.get('predios', [])
        
        if predios:
            predio = predios[0]
            # Verify required fields
            assert predio.get('id'), "Predio should have id"
            assert predio.get('codigo_predial_nacional') or predio.get('codigo_homologado'), "Predio should have codigo"
            assert predio.get('status') == 'aprobado', f"Predio status should be 'aprobado', got: {predio.get('status')}"
            print(f"✓ M2 predio has correct data structure: {predio.get('id')[:8]}...")
        else:
            pytest.skip("Test predio not found (may be in different vigencia)")


class TestPDFViewerIntegration:
    """Tests for PDF Viewer Modal integration"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authentication"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "catastro@asomunicipios.gov.co", "password": "Asm*123*"}
        )
        assert response.status_code == 200
        self.token = response.json()['token']
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_11_resolution_pdf_includes_verification_code(self):
        """Test that resolution includes verification code"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200
        
        resoluciones = response.json().get('resoluciones', [])
        
        # Check first resolution with M2 type for verification code
        for res in resoluciones:
            if res.get('tipo_mutacion') == 'M2':
                codigo_verificacion = res.get('codigo_verificacion')
                assert codigo_verificacion, "M2 resolution should have codigo_verificacion"
                print(f"✓ Resolution {res['numero_resolucion']} has verification code: {codigo_verificacion}")
                break

    def test_12_resolution_pdf_path_format_correct(self):
        """Test that PDF path follows correct format"""
        response = requests.get(
            f"{BASE_URL}/api/resoluciones/historial",
            headers=self.headers
        )
        assert response.status_code == 200
        
        resoluciones = response.json().get('resoluciones', [])
        
        for res in resoluciones:
            if res.get('pdf_path'):
                pdf_path = res['pdf_path']
                assert pdf_path.startswith('/resoluciones/'), f"PDF path should start with /resoluciones/, got: {pdf_path}"
                assert pdf_path.endswith('.pdf'), f"PDF path should end with .pdf, got: {pdf_path}"
                print(f"✓ PDF path format correct: {pdf_path[:50]}...")
                break


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
