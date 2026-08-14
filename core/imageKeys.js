// CLAVES DE LOS BANCOS DE IMÁGENES — el único sitio donde se ponen.
//
// Vive aparte a propósito: quien busca «dónde meto la clave» abre este fichero
// y no tiene que entender el buscador entero.
//
// ⚠️ ESTAS CLAVES SON PÚBLICAS. La app es una web estática (GitHub Pages): todo
// lo que hay aquí viaja al navegador y se puede leer en el código fuente. Por
// eso SOLO pueden vivir aquí claves que no dan acceso a nada — las de Pixabay y
// Pexels solo sirven para BUSCAR imágenes públicas, con un límite por minuto.
// Si alguna vez hace falta una clave que sí valga algo (Google, un servicio de
// pago), NO se pone aquí: se guarda en la Pi y la app le pregunta a la Pi.
//
// Peor caso si alguien copia una de estas: gasta el límite por minuto y la
// búsqueda falla un rato — el diálogo lo dice y se sigue pudiendo subir el
// archivo. Se arregla generando otra clave en el panel del proveedor.

/**
 * PIXABAY — clave gratuita, sin caducidad y sin tarjeta.
 * Cómo se saca (2 minutos):
 *   1. Crear cuenta en https://pixabay.com/accounts/register/
 *   2. Entrar en https://pixabay.com/api/docs/ — la clave aparece en la propia
 *      página, en el recuadro «Your API key».
 *   3. Pegarla aquí abajo, entre las comillas, y subir el cambio.
 * Mientras esté vacía, Pixabay NO aparece en el buscador: una fuente que no
 * puede funcionar no se ofrece (nada de opciones que fallan al tocarlas).
 */
export const PIXABAY_KEY = '';
