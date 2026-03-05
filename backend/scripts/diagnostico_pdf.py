"""
Script de diagnóstico para PDFs de resoluciones
Ejecutar en servidor de producción: python diagnostico_pdf.py

Este script verifica:
1. Si el directorio de resoluciones existe
2. Si los archivos PDF tienen contenido
3. Si hay permisos correctos
"""
import os
import sys
from pathlib import Path

# Rutas posibles donde pueden estar los PDFs
RUTAS_POSIBLES = [
    "/app/frontend/public/resoluciones",
    "/var/www/html/resoluciones",
    "/home/app/frontend/public/resoluciones",
    "./frontend/public/resoluciones",
    "./public/resoluciones",
]

def diagnosticar():
    print("=" * 60)
    print("DIAGNÓSTICO DE PDFs DE RESOLUCIONES")
    print("=" * 60)
    
    # 1. Buscar directorio de resoluciones
    print("\n1. BUSCANDO DIRECTORIO DE RESOLUCIONES...")
    directorio_encontrado = None
    
    for ruta in RUTAS_POSIBLES:
        if os.path.exists(ruta):
            print(f"   ✅ Encontrado: {ruta}")
            directorio_encontrado = ruta
            break
        else:
            print(f"   ❌ No existe: {ruta}")
    
    if not directorio_encontrado:
        print("\n   ⚠️  No se encontró el directorio de resoluciones")
        print("   Por favor verifica la ruta en tu configuración")
        return
    
    # 2. Verificar permisos
    print(f"\n2. VERIFICANDO PERMISOS DE {directorio_encontrado}...")
    try:
        stat_info = os.stat(directorio_encontrado)
        print(f"   Permisos: {oct(stat_info.st_mode)}")
        print(f"   UID: {stat_info.st_uid}, GID: {stat_info.st_gid}")
        
        if os.access(directorio_encontrado, os.R_OK):
            print("   ✅ Directorio legible")
        else:
            print("   ❌ Directorio NO legible")
            
        if os.access(directorio_encontrado, os.W_OK):
            print("   ✅ Directorio escribible")
        else:
            print("   ⚠️  Directorio NO escribible (puede ser problema)")
    except Exception as e:
        print(f"   ❌ Error verificando permisos: {e}")
    
    # 3. Listar archivos PDF
    print(f"\n3. LISTANDO ARCHIVOS PDF...")
    try:
        archivos = list(Path(directorio_encontrado).glob("*.pdf"))
        print(f"   Total archivos PDF: {len(archivos)}")
        
        if archivos:
            print("\n   Últimos 5 archivos:")
            archivos_ordenados = sorted(archivos, key=lambda x: x.stat().st_mtime, reverse=True)[:5]
            for archivo in archivos_ordenados:
                tamaño = archivo.stat().st_size
                fecha = archivo.stat().st_mtime
                from datetime import datetime
                fecha_str = datetime.fromtimestamp(fecha).strftime("%Y-%m-%d %H:%M:%S")
                
                status = "✅" if tamaño > 1000 else "⚠️ MUY PEQUEÑO"
                print(f"   {status} {archivo.name}")
                print(f"       Tamaño: {tamaño:,} bytes | Fecha: {fecha_str}")
    except Exception as e:
        print(f"   ❌ Error listando archivos: {e}")
    
    # 4. Verificar archivo específico (si se proporciona)
    if len(sys.argv) > 1:
        archivo_buscar = sys.argv[1]
        print(f"\n4. BUSCANDO ARCHIVO ESPECÍFICO: {archivo_buscar}")
        
        ruta_completa = os.path.join(directorio_encontrado, archivo_buscar)
        if os.path.exists(ruta_completa):
            tamaño = os.path.getsize(ruta_completa)
            print(f"   ✅ Archivo encontrado")
            print(f"   Tamaño: {tamaño:,} bytes")
            
            if tamaño < 1000:
                print("   ⚠️  ARCHIVO MUY PEQUEÑO - Probablemente vacío o corrupto")
            elif tamaño < 10000:
                print("   ⚠️  Archivo pequeño - Verificar contenido")
            else:
                print("   ✅ Tamaño parece correcto")
                
            # Verificar si es un PDF válido
            with open(ruta_completa, 'rb') as f:
                header = f.read(5)
                if header == b'%PDF-':
                    print("   ✅ Header PDF válido")
                else:
                    print(f"   ❌ Header inválido: {header}")
        else:
            print(f"   ❌ Archivo NO encontrado en {ruta_completa}")
    
    # 5. Recomendaciones
    print("\n" + "=" * 60)
    print("RECOMENDACIONES:")
    print("=" * 60)
    print("""
1. Si el PDF está vacío (0 bytes o muy pequeño):
   - Revisar logs del backend cuando se genera
   - Verificar que la función generate_resolucion_m2_pdf() no tenga errores

2. Si el PDF existe pero no se descarga:
   - Verificar configuración de nginx/apache para servir /resoluciones/
   - Agregar esta configuración a nginx:
   
     location /resoluciones/ {
         alias /app/frontend/public/resoluciones/;
         add_header Content-Type application/pdf;
     }

3. Si hay errores de permisos:
   - chmod 755 /app/frontend/public/resoluciones
   - chown www-data:www-data /app/frontend/public/resoluciones

4. Para ver logs de generación:
   - tail -f /var/log/supervisor/backend.err.log | grep -i pdf
""")

if __name__ == "__main__":
    diagnosticar()
