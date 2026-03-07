#target photoshop
app.bringToFront();

(function () {
    var TARGET_HEIGHT_PX = 1920;

    function c2t(s) { return app.charIDToTypeID(s); }
    function s2t(s) { return app.stringIDToTypeID(s); }

    if (app.documents.length === 0) {
        alert("Abra um documento com pranchetas (artboards) antes de rodar o script.");
        return;
    }

    var doc = app.activeDocument;

    var savedUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;

    function getActiveLayerId() {
        var ref = new ActionReference();
        ref.putProperty(s2t("property"), s2t("layerID"));
        ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        return executeActionGet(ref).getInteger(s2t("layerID"));
    }

    function selectLayerById(id) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putIdentifier(c2t("Lyr "), id);
        desc.putReference(c2t("null"), ref);
        desc.putBoolean(s2t("makeVisible"), false);
        executeAction(c2t("slct"), desc, DialogModes.NO);
    }

    function getLayerDescById(id) {
        var ref = new ActionReference();
        ref.putIdentifier(c2t("Lyr "), id);
        return executeActionGet(ref);
    }

    function isArtboardId(id) {
        try {
            var d = getLayerDescById(id);
            return d.hasKey(s2t("artboard"));
        } catch (e) {
            return false;
        }
    }

    function getArtboardRectById(id) {
        var d = getLayerDescById(id);
        var ab = d.getObjectValue(s2t("artboard"));
        var r = ab.getObjectValue(s2t("artboardRect"));
        return {
            top:    r.getDouble(s2t("top")),
            left:   r.getDouble(s2t("left")),
            bottom: r.getDouble(s2t("bottom")),
            right:  r.getDouble(s2t("right"))
        };
    }

    function unlockActiveLayerSafely() {
        // Tentativa 1 (DOM)
        try { doc.activeLayer.allLocked = false; } catch (e1) {}

        // Tentativa 2 (Action Manager) — se existir lock de posição etc.
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(c2t("Lyr "), c2t("Ordn"), c2t("Trgt"));
            desc.putReference(c2t("null"), ref);

            var lockDesc = new ActionDescriptor();
            lockDesc.putBoolean(s2t("protectAll"), false);
            lockDesc.putBoolean(s2t("protectPosition"), false);
            lockDesc.putBoolean(s2t("protectTransparency"), false);
            lockDesc.putBoolean(s2t("protectComposite"), false);

            desc.putObject(c2t("T   "), s2t("layerLocking"), lockDesc);
            executeAction(c2t("setd"), desc, DialogModes.NO);
        } catch (e2) {}
    }

    function editActiveArtboardRect(left, top, right, bottom) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putEnumerated(s2t("layer"), s2t("ordinal"), s2t("targetEnum"));
        desc.putReference(s2t("null"), ref);

        var abDesc = new ActionDescriptor();
        var rectDesc = new ActionDescriptor();

        // IMPORTANT: usar stringIDs top/left/bottom/right
        rectDesc.putDouble(s2t("top"), top);
        rectDesc.putDouble(s2t("left"), left);
        rectDesc.putDouble(s2t("bottom"), bottom);
        rectDesc.putDouble(s2t("right"), right);

        abDesc.putObject(s2t("artboardRect"), s2t("classFloatRect"), rectDesc);

        desc.putObject(s2t("artboard"), s2t("artboard"), abDesc);

        // IMPORTANT: 1 = redimensionar (senão pode não aplicar)
        desc.putInteger(s2t("changeSizes"), 1);

        executeAction(s2t("editArtboardEvent"), desc, DialogModes.NO);
    }

    function collectArtboardIds(layerSets, out) {
        for (var i = 0; i < layerSets.length; i++) {
            var ls = layerSets[i];
            var id = null;
            try { id = ls.id; } catch (e) { id = null; }

            if (id && isArtboardId(id)) out.push(id);

            if (ls.layerSets && ls.layerSets.length) {
                collectArtboardIds(ls.layerSets, out);
            }
        }
    }

    var originalId = null;
    try { originalId = getActiveLayerId(); } catch (e0) {}

    var artboardIds = [];
    collectArtboardIds(doc.layerSets, artboardIds);

    if (artboardIds.length === 0) {
        app.preferences.rulerUnits = savedUnits;
        alert("Nenhuma prancheta (artboard) foi encontrada neste documento.");
        return;
    }

    var changed = 0;
    var failed = 0;

    for (var a = 0; a < artboardIds.length; a++) {
        var id = artboardIds[a];

        try {
            selectLayerById(id);
            if (!isArtboardId(id)) continue;

            unlockActiveLayerSafely();

            var r = getArtboardRectById(id);
            var newBottom = r.top + TARGET_HEIGHT_PX;

            editActiveArtboardRect(r.left, r.top, r.right, newBottom);

            // Verificação real
            var r2 = getArtboardRectById(id);
            var h2 = (r2.bottom - r2.top);

            if (Math.abs(h2 - TARGET_HEIGHT_PX) < 0.5) changed++;
            else failed++;

        } catch (err) {
            failed++;
        }
    }

    // Restaurar seleção
    if (originalId !== null) {
        try { selectLayerById(originalId); } catch (e3) {}
    }

    app.preferences.rulerUnits = savedUnits;

    if (failed === 0) {
        alert("Concluído!\nAltura ajustada para " + TARGET_HEIGHT_PX + " px em " + changed + " artboard(s).");
    } else {
        alert("Finalizado com avisos:\n" +
              "OK: " + changed + " artboard(s)\n" +
              "Falhou/sem efeito: " + failed + " artboard(s)\n\n" +
              "Dica: verifique se alguma artboard está bloqueada (ícone de cadeado) ou se o documento está em modo somente leitura.");
    }
})();