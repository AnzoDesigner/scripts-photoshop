#target photoshop
app.bringToFront();

(function () {
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
            top: r.getDouble(s2t("top")),
            left: r.getDouble(s2t("left")),
            bottom: r.getDouble(s2t("bottom")),
            right: r.getDouble(s2t("right"))
        };
    }

    function unlockActiveLayerSafely() {
        try { doc.activeLayer.allLocked = false; } catch (e1) {}

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

        rectDesc.putDouble(s2t("top"), top);
        rectDesc.putDouble(s2t("left"), left);
        rectDesc.putDouble(s2t("bottom"), bottom);
        rectDesc.putDouble(s2t("right"), right);

        abDesc.putObject(s2t("artboardRect"), s2t("classFloatRect"), rectDesc);
        desc.putObject(s2t("artboard"), s2t("artboard"), abDesc);
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

    function showResizeDialog(defaultWidth, defaultHeight) {
        var dlg = new Window("dialog", "Redimensionar pranchetas");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";

        var info = dlg.add("statictext", undefined, "Informe o novo tamanho das pranchetas em pixels:");
        info.characters = 45;

        var sizeGroup = dlg.add("group");
        sizeGroup.orientation = "column";
        sizeGroup.alignChildren = ["fill", "top"];

        var widthGroup = sizeGroup.add("group");
        widthGroup.add("statictext", undefined, "Largura (px):");
        var widthInput = widthGroup.add("edittext", undefined, String(Math.round(defaultWidth)));
        widthInput.characters = 10;
        widthInput.active = true;

        var heightGroup = sizeGroup.add("group");
        heightGroup.add("statictext", undefined, "Altura (px):");
        var heightInput = heightGroup.add("edittext", undefined, String(Math.round(defaultHeight)));
        heightInput.characters = 10;

        var note = dlg.add("statictext", undefined, "As pranchetas serão redimensionadas a partir do canto superior esquerdo.");
        note.characters = 45;

        var buttons = dlg.add("group");
        buttons.alignment = "right";
        var okBtn = buttons.add("button", undefined, "OK", { name: "ok" });
        var cancelBtn = buttons.add("button", undefined, "Cancelar", { name: "cancel" });

        okBtn.onClick = function () {
            var width = parseFloat(String(widthInput.text).replace(",", "."));
            var height = parseFloat(String(heightInput.text).replace(",", "."));

            if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
                alert("Informe valores numéricos maiores que zero para largura e altura.");
                return;
            }

            dlg.resultData = {
                width: width,
                height: height
            };
            dlg.close(1);
        };

        cancelBtn.onClick = function () {
            dlg.close(0);
        };

        return dlg.show() === 1 ? dlg.resultData : null;
    }

    var originalId = null;

    try {
        try { originalId = getActiveLayerId(); } catch (e0) {}

        var artboardIds = [];
        collectArtboardIds(doc.layerSets, artboardIds);

        if (artboardIds.length === 0) {
            alert("Nenhuma prancheta (artboard) foi encontrada neste documento.");
            return;
        }

        var firstRect = getArtboardRectById(artboardIds[0]);
        var defaultWidth = firstRect.right - firstRect.left;
        var defaultHeight = firstRect.bottom - firstRect.top;

        var userSize = showResizeDialog(defaultWidth, defaultHeight);
        if (!userSize) {
            return;
        }

        var targetWidthPx = userSize.width;
        var targetHeightPx = userSize.height;

        var changed = 0;
        var failed = 0;

        for (var a = 0; a < artboardIds.length; a++) {
            var id = artboardIds[a];

            try {
                selectLayerById(id);
                if (!isArtboardId(id)) continue;

                unlockActiveLayerSafely();

                var r = getArtboardRectById(id);
                var newRight = r.left + targetWidthPx;
                var newBottom = r.top + targetHeightPx;

                editActiveArtboardRect(r.left, r.top, newRight, newBottom);

                var r2 = getArtboardRectById(id);
                var w2 = r2.right - r2.left;
                var h2 = r2.bottom - r2.top;

                if (Math.abs(w2 - targetWidthPx) < 0.5 && Math.abs(h2 - targetHeightPx) < 0.5) {
                    changed++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
            }
        }

        if (failed === 0) {
            alert(
                "Concluído!\n" +
                "Tamanho ajustado para " + Math.round(targetWidthPx) + " x " + Math.round(targetHeightPx) + " px em " + changed + " prancheta(s)."
            );
        } else {
            alert(
                "Finalizado com avisos:\n" +
                "OK: " + changed + " prancheta(s)\n" +
                "Falhou/sem efeito: " + failed + " prancheta(s)\n\n" +
                "Tamanho solicitado: " + Math.round(targetWidthPx) + " x " + Math.round(targetHeightPx) + " px\n\n" +
                "Dica: verifique se alguma prancheta está bloqueada (ícone de cadeado) ou se o documento está em modo somente leitura."
            );
        }
    } finally {
        if (originalId !== null) {
            try { selectLayerById(originalId); } catch (e3) {}
        }

        app.preferences.rulerUnits = savedUnits;
    }
})();