import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;

public class Index {
    static String ordnerPfad = "/home/kalle/Dokumente/GitHub/hypixel-texture-manager/backend/resourcepacks/FurfSky_Reborn"; // <-- hier anpassen
    static String jsonDateiPfad = "index.json";
    static String packid = "FURFSKY_REBORN";
    static String basisOrdnerPfad = "/home/kalle/Dokumente/GitHub/hypixel-texture-manager/backend/resourcepacks"; // Basisordner

    static Map<String, Map<String, String>> vorhandeneIDs = new TreeMap<>();

        public static void main(String[] args) {
        // JSON-Datei einlesen
        File jsonDatei = new File(jsonDateiPfad);
        if (jsonDatei.exists()) {
            try {
                List<String> zeilen = Files.readAllLines(jsonDatei.toPath());
                Map<String, String> currentPackData = null;
                String currentId = null;

                for (String zeile : zeilen) {
                    zeile = zeile.trim();
                    if (zeile.startsWith("\"")) {
                        if (zeile.contains(": {")) {
                            currentId = zeile.substring(1, zeile.indexOf("\"", 1));
                            currentPackData = new HashMap<>();
                            vorhandeneIDs.put(currentId, currentPackData);
                        }
                        if (zeile.contains("\"pfad\":")) {
                            String pfad = zeile.split(":")[1].trim().replace("\"", "").replace("\\\\", "\\");
                            if (currentPackData != null) {
                                currentPackData.put(packid, pfad);
                            }
                        }
                    }
                }
            } catch (IOException e) {
                System.err.println("Fehler beim Lesen der JSON-Datei: " + e.getMessage());
            }
        }



        // Dateien im Ordner und Unterordner durchgehen
        File ordner = new File(ordnerPfad);
        if (ordner.exists() && ordner.isDirectory()) {
            System.out.println("Durchsuche Ordner: " + ordnerPfad);
            durchsucheOrdner(ordner, vorhandeneIDs, basisOrdnerPfad, packid);
        }

        // JSON schreiben
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(jsonDateiPfad))) {
            writer.write("{\n");
            int count = 0;
            int size = vorhandeneIDs.size();
            for (Map.Entry<String, Map<String, String>> eintrag : vorhandeneIDs.entrySet()) {
                String id = eintrag.getKey();
                Map<String, String> packData = eintrag.getValue();

                writer.write("  \"" + id + "\": {\n");
                for (Map.Entry<String, String> packEntry : packData.entrySet()) {
                    String packidKey = packEntry.getKey();
                    String pfad = packEntry.getValue();

                    writer.write("    \"" + packidKey + "\": {\n");
                    writer.write("      \"pfad\": \"" + (pfad != null ? pfad.replace("\\", "\\\\") : "") + "\"\n");
                    writer.write("    }\n");
                }
                writer.write("  }" + (++count < size ? "," : "") + "\n");
            }
            writer.write("}\n");
            System.out.println("index.json wurde erfolgreich aktualisiert.");
        } catch (IOException e) {
            System.err.println("Fehler beim Schreiben der JSON-Datei: " + e.getMessage());
        }
    }

    // Rekursive Methode, um alle Dateien im Ordner und in Unterordnern zu durchsuchen
    private static void durchsucheOrdner(File ordner, Map<String, Map<String, String>> vorhandeneIDs, String basisOrdnerPfad, String packid) {
        // Alle Dateien und Unterordner des aktuellen Ordners durchgehen
        for (File datei : Objects.requireNonNull(ordner.listFiles())) {
            if (datei.isDirectory()) {
                // Wenn es ein Ordner ist, rufe die Methode rekursiv auf
                System.out.println("Durchsuche Unterordner: " + datei.getAbsolutePath());
                durchsucheOrdner(datei, vorhandeneIDs, basisOrdnerPfad, packid);
            } else if (datei.isFile()) {
                // Wenn es eine Datei ist, den Namen extrahieren und die ID prüfen
                String name = datei.getName();
                System.out.println("Verarbeite Datei: " + name);
                String[] teile = name.split("\\.", 2);
                if (teile.length == 2) {
                    String id = teile[0];
                    // Berechnung des relativen Pfads zum Basisordner
                    try {
                        Path dateiPfad = datei.toPath();
                        Path basisOrdnerPath = Paths.get(basisOrdnerPfad);

                        // Berechne den relativen Pfad von basisOrdnerPfad zur Datei
                        Path relativPfad = basisOrdnerPath.relativize(dateiPfad);
                        String relativPfadString = relativPfad.toString().replace("\\", "/");

                        // Wenn die ID bereits existiert, überprüfen, ob der Pfad unterschiedlich ist
                        if (vorhandeneIDs.containsKey(id)) {
                            String existierenderPfad = vorhandeneIDs.get(id).get(packid);
                            if (existierenderPfad != null && !existierenderPfad.equals(relativPfadString)) {
                                // Wenn der Pfad unterschiedlich ist, überschreiben wir ihn
                                vorhandeneIDs.get(id).put(packid, relativPfadString);
                                System.out.println("Pfad für ID " + id + " wurde aktualisiert.");
                            }
                        } else {
                            // Wenn die ID noch nicht existiert, fügen wir sie hinzu
                            vorhandeneIDs.put(id, new HashMap<>());
                            vorhandeneIDs.get(id).put(packid, relativPfadString);
                            System.out.println("Neue ID " + id + " hinzugefügt.");
                        }
                    } catch (Exception e) {
                        System.err.println("Fehler beim Berechnen des relativen Pfads: " + e.getMessage());
                    }
                } else {
                    System.out.println("Datei ignoriert (kein valides Format): " + name);
                }
            }
        }


    }
}
