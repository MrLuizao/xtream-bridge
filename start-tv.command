#!/bin/zsh

# Limpiar la pantalla
clear

echo "================================================="
echo "       📺 INICIANDO SERVIDOR DE TV 📺"
echo "================================================="
echo ""
echo "1. Abriendo Docker..."
open -a "Docker" 2>/dev/null || echo "   ⚠️ No se pudo abrir Docker automáticamente. Por favor ábrelo manualmente."
echo "   Esperando a que Docker termine de cargar (7 segundos)..."
sleep 7

echo "2. Iniciando motor P2P independiente..."
docker rm -f ace-bridge 2>/dev/null
docker run -d --rm --name ace-bridge -p 6879:6878 blaiseio/acelink:2.1.0 2>/dev/null
echo ""
echo "Iniciando servidor de TV..."
echo "-------------------------------------------------"

# Ir a la carpeta donde está este script
cd "$(dirname "$0")"

# Matar cualquier servidor anterior que haya quedado abierto en el puerto 3000
echo "Limpiando sesiones anteriores..."
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Forzar el uso del entorno de usuario interactivo para que encuentre NVM/Node
zsh -i -c "nvm use 24 && npm run dev || npm run dev"

echo ""
echo "Presiona ENTER para cerrar esta ventana..."
read

