import java.io.*;
import java.nio.file.Files;
import java.util.*;

public class IndexUpdaterPlain {

    public static void main(String[] args) {
        String ordnerPfad = "/home/kalle/Dokumente/GitHub/hypixel-texture-manager/backend/resourcepacks/FurfSky_Reborn"; // <-- hier anpassen
        String jsonDateiPfad = "index.json";
        String packid = "FURFSKY_REBORN";

        Map<String, String> vorhandeneIDs = new TreeMap<>();

        // JSON-Datei einlesen
        File jsonDatei = new File(jsonDateiPfad);
        if (jsonDatei.exists()) {
            try {
                List<String> zeilen = Files.readAllLines(jsonDatei.toPath());
                for (String zeile : zeilen) {
                    zeile = zeile.trim();
                    if (zeile.startsWith("\"") && zeile.contains(":")) {
                        String id = zeile.substring(1, zeile.indexOf("\"", 1));
                        vorhandeneIDs.put(id, null); // Wert wird später ersetzt
                    }
                }
            } catch (IOException e) {
                System.err.println("Fehler beim Lesen: " + e.getMessage());
            }
        }

        // Dateien im Ordner durchgehen
        File ordner = new File(ordnerPfad);
        if (ordner.exists() && ordner.isDirectory()) {
            for (File datei : Objects.requireNonNull(ordner.listFiles())) {
                if (datei.isFile()) {
                    String name = datei.getName();
                    String[] teile = name.split("\\.", 2);
                    if (teile.length == 2) {
                        String id = teile[0];
                        if (!vorhandeneIDs.containsKey(id)) {
                            String basisOrdnerName = ordner.getName();
String relativerPfad = basisOrdnerName + "/" +
    ordner.toPath().relativize(datei.toPath()).toString().replace("\\", "/");
vorhandeneIDs.put(id, relativerPfad);

                        }
                    }
                }
            }
        }

        // JSON schreiben
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(jsonDateiPfad))) {
            writer.write("{\n");
            int count = 0;
            int size = vorhandeneIDs.size();
            for (Map.Entry<String, String> eintrag : vorhandeneIDs.entrySet()) {
                String id = eintrag.getKey();
                String pfad = eintrag.getValue();

                writer.write("  \"" + id + "\": {\n");
                writer.write("    \"" + packid + "\": {\n");
                writer.write("      \"pfad\": \"" + (pfad != null ? pfad.replace("\\", "\\\\") : "") + "\"\n");
                writer.write("    }\n");
                writer.write("  }" + (++count < size ? "," : "") + "\n");
            }
            writer.write("}\n");
            System.out.println("index.json wurde aktualisiert.");
        } catch (IOException e) {
            System.err.println("Fehler beim Schreiben: " + e.getMessage());
        }
    }
}
