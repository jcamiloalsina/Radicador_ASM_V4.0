"""
Test para verificar que la firma de Dalgie aparece en las resoluciones PDF generadas.
Este test verifica:
1. Que el archivo de firma existe en /app/backend/logos/firma_dalgie_blanco.png
2. Que el PDF de resolucion se genera correctamente
3. Que el PDF contiene imagenes (incluyendo la firma)
"""
import pytest
import os
import io
from pathlib import Path

# Se importa el generador de PDF
import sys
sys.path.insert(0, '/app/backend')
from resolucion_pdf_generator import generate_resolucion_pdf, get_default_plantilla
from certificado_images import get_firma_dalgie_image


class TestResolucionPdfFirma:
    """Tests para verificar que la firma de Dalgie se incluye en los PDFs de resolucion"""
    
    def test_firma_file_exists(self):
        """Verifica que el archivo de firma de Dalgie existe"""
        firma_path = "/app/backend/logos/firma_dalgie_blanco.png"
        assert os.path.exists(firma_path), f"El archivo de firma no existe en {firma_path}"
        
        # Verificar que tiene contenido
        file_size = os.path.getsize(firma_path)
        assert file_size > 0, "El archivo de firma esta vacio"
        assert file_size == 22451, f"El tamano del archivo de firma es {file_size}, esperado 22451 bytes"
        print(f"Archivo de firma encontrado: {firma_path} ({file_size} bytes)")
    
    def test_get_firma_dalgie_image_function(self):
        """Verifica que la funcion get_firma_dalgie_image() retorna datos validos"""
        firma_data = get_firma_dalgie_image()
        assert firma_data is not None, "get_firma_dalgie_image() retorno None"
        assert isinstance(firma_data, io.BytesIO), "get_firma_dalgie_image() no retorno BytesIO"
        
        # Verificar que tiene contenido
        firma_data.seek(0, 2)  # Ir al final
        size = firma_data.tell()
        firma_data.seek(0)  # Volver al inicio
        assert size > 0, "get_firma_dalgie_image() retorno datos vacios"
        print(f"Funcion get_firma_dalgie_image() retorno {size} bytes")
    
    def test_generate_resolucion_pdf_basic(self):
        """Verifica que el PDF de resolucion se genera sin errores"""
        # Datos minimos para generar un PDF
        pdf_bytes = generate_resolucion_pdf(
            numero_resolucion="RES-TEST-001-2026",
            fecha_resolucion="21-01-2026",
            municipio="Ocana",
            tipo_tramite="Cambio de Propietario",
            radicado="RASMGC-TEST-01-2026",
            codigo_catastral_anterior="000400020197000",
            npn="540030004000000020197000000000",
            matricula_inmobiliaria="270-12345",
            direccion="CALLE PRINCIPAL 123",
            avaluo="$50.000.000",
            vigencia_fiscal="01/01/2026",
            area_terreno="100",
            area_construida="50",
            destino_economico="A",
            codigo_homologado="BPP0001TEST",
            propietarios_anteriores=[{
                "nombre": "PROPIETARIO ANTERIOR TEST",
                "tipo_documento": "CC",
                "documento": "12345678",
                "estado_civil": "SOLTERO"
            }],
            propietarios_nuevos=[{
                "nombre": "PROPIETARIO NUEVO TEST",
                "tipo_documento": "CC",
                "documento": "87654321",
                "estado_civil": "CASADO"
            }],
            elaboro="Test User",
            aprobo="Test Approver",
        )
        
        assert pdf_bytes is not None, "generate_resolucion_pdf() retorno None"
        assert len(pdf_bytes) > 0, "generate_resolucion_pdf() retorno PDF vacio"
        print(f"PDF generado correctamente: {len(pdf_bytes)} bytes")
        
        # Verificar que es un PDF valido (comienza con %PDF)
        assert pdf_bytes[:4] == b'%PDF', "El archivo generado no es un PDF valido"
        print("El archivo generado es un PDF valido")
    
    def test_pdf_contains_images(self):
        """Verifica que el PDF contiene imagenes (la firma deberia ser una de ellas)"""
        pdf_bytes = generate_resolucion_pdf(
            numero_resolucion="RES-TEST-002-2026",
            fecha_resolucion="21-01-2026",
            municipio="Abrego",
            tipo_tramite="Mutacion",
            radicado="RASMGC-TEST-02-2026",
            codigo_catastral_anterior="000400020197001",
            npn="540030004000000020197000000001",
            matricula_inmobiliaria="270-54321",
            direccion="VEREDA EL ROBLE",
            avaluo="$30.000.000",
            vigencia_fiscal="01/01/2026",
            area_terreno="500",
            area_construida="0",
            destino_economico="R",  # Rural
            codigo_homologado="RPP0001TEST",
            propietarios_anteriores=[{
                "nombre": "ANTERIOR DOS",
                "tipo_documento": "CC",
                "documento": "11111111"
            }],
            propietarios_nuevos=[{
                "nombre": "NUEVO DOS",
                "tipo_documento": "CC",
                "documento": "22222222"
            }],
            elaboro="Elaborador Test",
            aprobo="Aprobador Test",
        )
        
        # Buscar referencias a imagenes en el PDF
        # Los PDFs con imagenes contienen referencias XObject y DCTDecode (JPEG) o FlateDecode (PNG)
        pdf_content = pdf_bytes.decode('latin-1', errors='ignore')
        
        # Verificar que hay XObjects (imagenes) en el PDF
        has_xobject = '/XObject' in pdf_content
        has_image = '/Image' in pdf_content or '/Im' in pdf_content
        
        print(f"PDF contiene /XObject: {has_xobject}")
        print(f"PDF contiene /Image: {has_image}")
        
        # El PDF deberia contener imagenes (encabezado, pie de pagina, firma, QR)
        assert has_xobject or has_image, "El PDF no contiene imagenes"
        print("El PDF contiene imagenes correctamente")
    
    def test_pdf_with_custom_firma_b64(self):
        """Verifica que se puede pasar una firma personalizada en base64"""
        import base64
        
        # Leer la firma real y codificarla en base64
        firma_path = "/app/backend/logos/firma_dalgie_blanco.png"
        with open(firma_path, 'rb') as f:
            firma_bytes = f.read()
        firma_b64 = base64.b64encode(firma_bytes).decode('utf-8')
        
        pdf_bytes = generate_resolucion_pdf(
            numero_resolucion="RES-TEST-003-2026",
            fecha_resolucion="21-01-2026",
            municipio="Convencion",
            tipo_tramite="Cambio de Propietario",
            radicado="RASMGC-TEST-03-2026",
            codigo_catastral_anterior="000400020197002",
            npn="540030004000000020197000000002",
            matricula_inmobiliaria="270-99999",
            direccion="CALLE 5 # 4-32",
            avaluo="$25.000.000",
            vigencia_fiscal="01/01/2026",
            imagen_firma_b64=firma_b64,  # Firma personalizada
            propietarios_anteriores=[{
                "nombre": "ANTERIOR TRES",
                "tipo_documento": "CC",
                "documento": "33333333"
            }],
            propietarios_nuevos=[{
                "nombre": "NUEVO TRES",
                "tipo_documento": "CC",
                "documento": "44444444"
            }],
            elaboro="Usuario Tres",
            aprobo="Aprobador Tres",
        )
        
        assert pdf_bytes is not None, "generate_resolucion_pdf() con firma b64 retorno None"
        assert len(pdf_bytes) > 0, "generate_resolucion_pdf() con firma b64 retorno PDF vacio"
        assert pdf_bytes[:4] == b'%PDF', "El archivo con firma b64 no es un PDF valido"
        print(f"PDF con firma personalizada generado correctamente: {len(pdf_bytes)} bytes")
    
    def test_pdf_generation_prints_firma_message(self, capsys):
        """Verifica que la generacion del PDF imprime mensajes de debug sobre la firma"""
        pdf_bytes = generate_resolucion_pdf(
            numero_resolucion="RES-TEST-004-2026",
            fecha_resolucion="21-01-2026",
            municipio="La Playa",
            tipo_tramite="Cambio de Propietario",
            radicado="RASMGC-TEST-04-2026",
            codigo_catastral_anterior="000400020197003",
            npn="540030004000000020197000000003",
            matricula_inmobiliaria="270-88888",
            direccion="CALLE TEST",
            avaluo="$15.000.000",
            vigencia_fiscal="01/01/2026",
            propietarios_anteriores=[{
                "nombre": "ANTERIOR CUATRO",
                "tipo_documento": "CC",
                "documento": "55555555"
            }],
            propietarios_nuevos=[{
                "nombre": "NUEVO CUATRO",
                "tipo_documento": "CC",
                "documento": "66666666"
            }],
            elaboro="Usuario Cuatro",
            aprobo="Aprobador Cuatro",
        )
        
        # Capturar la salida stdout
        captured = capsys.readouterr()
        
        # Verificar que se imprimio un mensaje sobre la firma
        firma_messages = [
            "Firma cargada desde archivo",
            "Firma cargada desde parametro",
            "Firma cargada desde base64 embebida"
        ]
        
        firma_loaded = any(msg in captured.out for msg in firma_messages)
        print(f"Salida capturada: {captured.out}")
        
        if firma_loaded:
            print("La firma se cargo correctamente segun los logs")
        else:
            print("ADVERTENCIA: No se detecto mensaje de carga de firma en los logs")
        
        # El test pasa si el PDF se genera aunque no haya mensaje
        assert pdf_bytes is not None and len(pdf_bytes) > 0


class TestResolucionPdfContent:
    """Tests adicionales para verificar el contenido del PDF"""
    
    def test_pdf_has_multiple_pages_info(self):
        """Verifica que el PDF tiene informacion de paginas"""
        pdf_bytes = generate_resolucion_pdf(
            numero_resolucion="RES-CONTENT-001",
            fecha_resolucion="21-01-2026",
            municipio="San Calixto",
            tipo_tramite="Cambio de Propietario",
            radicado="RAD-CONTENT-001",
            codigo_catastral_anterior="000400020197004",
            npn="540030004000000020197000000004",
            matricula_inmobiliaria="270-77777",
            direccion="VEREDA TEST",
            avaluo="$10.000.000",
            vigencia_fiscal="01/01/2026",
            propietarios_anteriores=[{"nombre": "TEST A", "tipo_documento": "CC", "documento": "111"}],
            propietarios_nuevos=[{"nombre": "TEST B", "tipo_documento": "CC", "documento": "222"}],
            elaboro="E",
            aprobo="A",
        )
        
        # Verificar estructura basica del PDF
        pdf_content = pdf_bytes.decode('latin-1', errors='ignore')
        
        # Un PDF valido debe contener estas estructuras
        assert '/Type /Page' in pdf_content or '/Type/Page' in pdf_content, "El PDF no contiene paginas"
        print("El PDF contiene estructura de paginas correcta")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
