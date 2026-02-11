/**
 * Datos de sitios LPR y Cotejo Facial para poblar la colección `sites` en Firestore.
 * Coordenadas en grados decimales (lat, lng). Fuente: docs/Base de datos sitios.md
 */

/** Convierte DMS (ej. "3°31'28\"N 76°20'14\"W" o "3°23'45.82\"N 76°22'41.30\"O") a [lat, lng] en decimal. */
function parseDMS(dmsStr) {
  if (!dmsStr || typeof dmsStr !== 'string') return [null, null];
  const normalized = dmsStr.replace(/"/g, '"').replace(/''/g, "'").trim();
  const latMatch = normalized.match(/(\d+)°\s*(\d+)'?\s*([\d.]+)"?\s*([NS])/i);
  const lngRegex = /(\d+)°\s*(\d+)'?\s*([\d.]+)"?\s*([OWE])/gi;
  const lngMatch = lngRegex.exec(normalized);
  if (!latMatch || !lngMatch) return [null, null];
  const lat = parseInt(latMatch[1], 10) + parseInt(latMatch[2], 10) / 60 + parseFloat(latMatch[3]) / 3600;
  const lng = parseInt(lngMatch[1], 10) + parseInt(lngMatch[2], 10) / 60 + parseFloat(lngMatch[3]) / 3600;
  const latSign = latMatch[4].toUpperCase() === 'S' ? -1 : 1;
  const lngSign = (lngMatch[4].toUpperCase() === 'W' || lngMatch[4].toUpperCase() === 'O') ? -1 : 1;
  return [latSign * lat, lngSign * lng];
}

/** LPR: Punto, Distrito, Municipio, Dirección, Coordenadas (DMS), Cant. Cámaras (tabla con cámaras) */
const lprRows = [
  ['LPR 1', 'DISTRITO PALMIRA', 'PALMIRA', 'La recta Cali Palmira', "3°31'28\"N 76°20'14\"W", 4],
  ['LPR 2', 'DISTRITO MECAL', 'CANDELARIA', 'Candelaria Crucero', "3°23'44\"N 76°21'13\"W", 4],
  ['LPR 3', 'DISTRITO BUGA', 'YOTOCO', 'Media Canoa Glorieta', "3°53'33\"N 76°22'08\"W", 2],
  ['LPR 4', 'DISTRITO DAGUA', 'DAGUA', 'Descanso del ciclista (Vía Media Canoa)', "3°53'10\"N 76°24'22\"W", 2],
  ['LPR 5', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Zabaletas', "3°48'44\"N 76°37'18\"W", 2],
  ['LPR 6', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Lobo Guerrero - Cerca al peaje', "3°45'53\"N 76°40'02\"W", 2],
  ['LPR 7', 'DISTRITO MECAL', 'CANDELARIA', 'Entrada Villa Gorgona', "3°23'45.82\"N 76°22'41.30\"O", 2],
  ['LPR 8', 'DISTRITO CARTAGO', 'CARTAGO', 'Zaragoza', "3°51'39\"N 76°51'20\"W", 1],
  ['LPR 9', 'DISTRITO MECAL', 'CANDELARIA', 'Entrada Poblado Campestre', "3°24'46.34\"N 76°27'8.58\"O", 2],
  ['LPR 10', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Córdoba Salida', "3°52'47\"N 76°55'32\"W", 1],
  ['LPR 11', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Buenaventura CONFAMAR', "3°52'47\"N 76°55'32\"W", 2],
  ['LPR 12', 'DISTRITO BUGA', 'BUGA', 'Picapiedra (Vía Media Canoa – La Virginia)', "3°53'27\"N 76°21'39\"W", 2],
  ['LPR 13', 'DISTRITO BUGA', 'BUGA', 'Buga SENA', "3°53'35\"N 76°18'42\"W", 2],
  ['LPR 14', 'DISTRITO BUGA', 'SAN PEDRO', 'San Pedro', "3°59'42\"N 76°13'56\"W", 2],
  ['LPR 15', 'DISTRITO TULUÁ', 'TULUÁ', 'Tuluá entrada y salida sur', "4°03'12\"N 76°12'05\"W", 2],
  ['LPR 16', 'DISTRITO TULUÁ', 'TULUÁ', 'Tuluá entrada y salida norte', "4°05'48\"N 76°10'31\"W", 2],
  ['LPR 17', 'DISTRITO TULUÁ', 'BUGALAGRANDE', 'La Uribe Cruce Sevilla', "4°15'22\"N 76°06'52\"W", 2],
  ['LPR 18', 'DISTRITO ROLDANILLO', 'ZARZAL', 'La Paila Cruce Corozal', "4°19'51\"N 76°04'10\"W", 2],
  ['LPR 19', 'DISTRITO SEVILLA', 'SEVILLA', 'Corozal', "4°23'56\"N 75°55'14\"W", 1],
  ['LPR 20', 'DISTRITO CARTAGO', 'LA VICTORIA', 'La Victoria Palo de Leche', "4°29'27\"N 76°01'42\"W", 1],
  ['LPR 21', 'DISTRITO CARTAGO', 'CARTAGO', 'Zaragoza', "4°42'12\"N 75°55'27\"W", 1],
  ['LPR 22', 'DISTRITO CARTAGO', 'CARTAGO', 'Cartago ingreso', "4°43'56\"N 75°54'43\"W", 4],
  ['LPR 23', 'DISTRITO CARTAGO', 'ANSERMANUEVO', 'Anserma Nuevo Glorieta', "4°47'25\"N 75°58'36\"W", 1],
  ['LPR 24', 'DISTRITO ROLDANILLO', 'TORO', 'Toro Peaje', "4°39'55\"N 76°02'58\"W", 1],
  ['LPR 25', 'DISTRITO ROLDANILLO', 'LA UNIÓN', 'La Unión Glorieta', "4°31'49\"N 76°05'11\"W", 1],
  ['LPR 26', 'DISTRITO ROLDANILLO', 'ROLDANILLO', 'Roldanillo Glorieta', "4°24'54\"N 76°08'40\"W", 1],
  ['LPR 27', 'DISTRITO TULUÁ', 'RIO FRIO', 'Rio Frio Glorieta', "4°08'54\"N 76°16'48\"W", 1],
  ['LPR 28', 'DISTRITO PALMIRA', 'FLORIDA', 'Florida', "3°17'59.15\"N 76°13'51.38\"O", 2],
  ['LPR 29', 'DISTRITO PALMIRA', 'PALMIRA', 'Palmira', "3°37'15.53\"N 76°26'47.42\"O", 2],
];

/** Cotejo Facial: Punto, Distrito, Municipio, Dirección, Coordenadas (tabla actualizada) */
const cotejoFacialRows = [
  ['F.1', 'DISTRITO BUGA', 'BUGA', 'Entrada Alcaldía de Buga, Cra. 13A Sur #6-50', "3°53'58\"N 76°18'04\"W"],
  ['F.2', 'DISTRITO BUGA', 'BUGA', 'Distrito de policía Buga, Cra. 14a #1 Sur-2 a 1 Sur-70', "3°53'36\"N 76°18'13\"W"],
  ['F.3', 'DISTRITO BUGA', 'BUGA', 'C.C. Buga Plaza, Cl. 4 #23 – 86', "3°54'02\"N 76°18'39\"W"],
  ['F.4', 'DISTRITO BUGA', 'BUGA', 'Calle 1 carrera 11, zona rosa', "3°53'40\"N 76°18'00\"W"],
  ['F.5', 'DISTRITO BUGA', 'BUGA', 'Cra. 12 salida sur, Vía Quebrada Seca, centro recreativo', "3°52'52\"N 76°17'57\"W"],
  ['F.6', 'DISTRITO BUGA', 'BUGA', 'Cra. 13 entra calle 8 y 9, centro', "3°54'02\"N 76°18'00\"W"],
  ['F.7', 'DISTRITO TULUÁ', 'TULUÁ', 'Palacio de justicia Tuluá, Cl. 25 #26-46', "4°05'07\"N 76°11'44\"W"],
  ['F.8', 'DISTRITO TULUÁ', 'TULUÁ', 'C.C. La Herradura, Cra. 19 #28-76', "4°05'02\"N 76°12'12\"W"],
  ['F.9', 'DISTRITO TULUÁ', 'TULUÁ', 'C.C. Mall Plaza, Cra. 40 #37-51', "4°04'23\"N 76°11'25\"W"],
  ['F.10', 'DISTRITO TULUÁ', 'TULUÁ', 'Secretaria de Transito Tuluá, Cra. 30 callejón morales', "4°05'44\"N 76°11'18\"W"],
  ['F.11', 'DISTRITO TULUÁ', 'TULUÁ', 'Coliseo de ferias, Cl. 13 #41-185', "4°05'41\"N 76°11'12\"W"],
  ['F.12', 'DISTRITO TULUÁ', 'TULUÁ', 'C.C. Bicentenario, Cl. 28 #19-38', "4°05'02\"N 76°12'06\"W"],
  ['F.13', 'DISTRITO PALMIRA', 'PALMIRA', 'Coliseo de ferias, Cra. 24 #19-00', "3°31'05\"N 76°17'44\"W"],
  ['F.14', 'DISTRITO PALMIRA', 'PALMIRA', 'Parque del azúcar, Cl. 42 #35 esquina', "3°32'21\"N 76°18'27\"W"],
  ['F.15', 'DISTRITO PALMIRA', 'PALMIRA', 'C.C. Llano Grande, Cl. 31 #44-239', "3°31'44\"N 76°19'00\"W"],
  ['F.16', 'DISTRITO PALMIRA', 'PALMIRA', 'C.C. Unicentro, Cl. 42 #39-68', "3°32'22\"N 76°18'37\"W"],
  ['F.17', 'DISTRITO PALMIRA', 'PALMIRA', 'Alcaldía, Cl. 39 con Cra. 39 esquina', "3°31'37\"N 76°18'00\"W"],
  ['F.18', 'DISTRITO PALMIRA', 'PALMIRA', 'Secretaria de tránsito, Cra. 35 #42-291', "3°32'30\"N 76°18'26\"W"],
  ['F.19', 'DISTRITO CARTAGO', 'CARTAGO', 'Alcaldía, Cl. 8 #6-52', "4°44'52\"N 75°54'34\"W"],
  ['F.20', 'DISTRITO CARTAGO', 'CARTAGO', 'Palacio de justicia, Cl. 11 #4-29', "4°44'55\"N 75°54'45\"W"],
  ['F.21', 'DISTRITO CARTAGO', 'CARTAGO', 'Parque Simón Bolívar', "4°44'58\"N 75°54'46\"W"],
  ['F.22', 'DISTRITO CARTAGO', 'CARTAGO', 'C.C. Nuestro Cartago, Cl. 34 #2-45', "4°45'25\"N 75°56'01\"W"],
  ['F.23', 'DISTRITO CARTAGO', 'CARTAGO', 'Registraduría, Cl. 14 entre Cra 5 y 6', "4°44'54\"N 75°54'57\"W"],
  ['F.24', 'DISTRITO CARTAGO', 'CARTAGO', 'Santiago Plaza, Cl. 14 #11-19', "4°44'33\"N 75°54'56\"W"],
  ['F.25', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Alcaldía, Cl. 2 con Cra. 3', "3°53'16\"N 77°04'37\"W"],
  ['F.26', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Muelle turístico', "3°53'20\"N 77°04'49\"W"],
  ['F.27', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Terminal transporte, Cra. 5 #7-32', "3°53'23\"N 77°04'25\"W"],
  ['F.28', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Secretaria de tránsito, Cra. 10 #5ª-2', "3°53'07\"N 77°04'14\"W"],
  ['F.29', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'C.C. Bellavista, Cl. 5b #45-64', "3°52'57\"N 77°01'13\"W"],
  ['F.30', 'DISTRITO BUENAVENTURA', 'BUENAVENTURA', 'Viva Centro Comercial, Cl. 5b #45-64', "3°52'03\"N 76°59'49\"W"],
  ['F.31', 'DISTRITO TULUÁ', 'TRUJILLO', 'Alcaldía, Cl. 20 #19-01', "4°12'45\"N 76°19'05\"W"],
  ['F.32', 'DISTRITO BUGA', 'CALIMA', 'Alcaldía, Cl. 10 #6-25', "3°55'52\"N 76°29'03\"W"],
];

function buildSitesForFirestore() {
  const sites = [];
  lprRows.forEach((row, index) => {
    const [siteCode, distrito, municipio, address, coordsDms, camerasCount] = row;
    const [lat, lng] = parseDMS(coordsDms);
    sites.push({
      id: `lpr-${index + 1}`,
      site_code: siteCode,
      site_type: 'lpr',
      distrito,
      municipio,
      name: siteCode,
      address,
      latitude: lat,
      longitude: lng,
      cameras_count: camerasCount ?? 0,
      description: '',
    });
  });
  cotejoFacialRows.forEach((row, index) => {
    const [siteCode, distrito, municipio, address, coordsDms] = row;
    const [lat, lng] = parseDMS(coordsDms);
    sites.push({
      id: `f-${index + 1}`,
      site_code: siteCode,
      site_type: 'cotejo_facial',
      distrito,
      municipio,
      name: siteCode,
      address,
      latitude: lat,
      longitude: lng,
      cameras_count: 0,
      description: '',
    });
  });
  return sites;
}

export { buildSitesForFirestore, parseDMS, lprRows, cotejoFacialRows };
