#target photoshop
app.bringToFront();

(function () {
    if (app.documents.length === 0) {
        alert("Nenhum documento aberto.");
        return;
    }

    var opts = showDialog();
    if (!opts) return;

    if (!opts.collapseArtboards && !opts.collapseGroups) {
        alert("Selecione pelo menos uma opção.");
        return;
    }

    var doc = app.activeDocument;
    var topSets = getTopLevelLayerSets(doc);
    var hasArtboards = containsArtboards(topSets);
    var hasRegularGroups = containsRegularGroups(topSets);

    if (topSets.length === 0) {
        alert("O documento não possui grupos ou pranchetas para recolher.");
        return;
    }

    // Caso simples: recolher tudo
    if (opts.collapseArtboards && opts.collapseGroups) {
        collapseAllGroups();
        alert("Concluído: pranchetas e grupos/camadas recolhidos.");
        return;
    }

    // Caso: só pranchetas
    if (opts.collapseArtboards && !opts.collapseGroups) {
        if (!hasArtboards) {
            alert("O documento não possui pranchetas para recolher.");
            return;
        }

        collapseAllGroups();

        // Reabre apenas grupos normais de nível superior
        // e seus subgrupos, mantendo as pranchetas recolhidas.
        reopenRegularGroupsFromDocument(doc);

        alert("Concluído: pranchetas recolhidas.");
        return;
    }

    // Caso: só grupos/camadas
    if (!opts.collapseArtboards && opts.collapseGroups) {
        if (!hasRegularGroups) {
            if (hasArtboards) {
                alert("O documento não possui grupos comuns para recolher.");
            } else {
                alert("O documento não possui grupos ou pranchetas para recolher.");
            }
            return;
        }

        collapseAllGroups();

        // Reabre apenas as pranchetas de nível superior,
        // deixando os grupos internos recolhidos.
        reopenArtboardsOnly(doc);

        alert("Concluído: grupos/camadas recolhidos.");
        return;
    }

    alert("Nada foi alterado.");
})();

function showDialog() {
    var dlg = new Window("dialog", "Recolher visualização");
    dlg.orientation = "column";
    dlg.alignChildren = "left";
    dlg.spacing = 10;
    dlg.margins = 16;

    dlg.add("statictext", undefined, "Escolha o que deseja recolher no painel:");
    dlg.add("statictext", undefined, "Obs.: camadas simples não recolhem; esta opção atua em grupos/pastas.");

    var chkArtboards = dlg.add("checkbox", undefined, "Recolher pranchetas");
    chkArtboards.value = true;

    var chkGroups = dlg.add("checkbox", undefined, "Recolher grupos/camadas");
    chkGroups.value = true;

    var btns = dlg.add("group");
    btns.alignment = "right";

    var okBtn = btns.add("button", undefined, "Executar", { name: "ok" });
    var cancelBtn = btns.add("button", undefined, "Cancelar", { name: "cancel" });

    okBtn.onClick = function () {
        dlg.close(1);
    };

    cancelBtn.onClick = function () {
        dlg.close(0);
    };

    dlg.center();
    var result = dlg.show();

    if (result !== 1) return null;

    return {
        collapseArtboards: chkArtboards.value,
        collapseGroups: chkGroups.value
    };
}

function collapseAllGroups() {
    try {
        app.runMenuItem(stringIDToTypeID("collapseAllGroupsEvent"));
    } catch (e) {
        executeAction(stringIDToTypeID("collapseAllGroupsEvent"), new ActionDescriptor(), DialogModes.NO);
    }
}

function getTopLevelLayerSets(doc) {
    var arr = [];
    var i, lyr;

    for (i = 0; i < doc.layers.length; i++) {
        lyr = doc.layers[i];
        if (lyr.typename === "LayerSet") {
            arr.push(lyr);
        }
    }

    return arr;
}

function containsArtboards(layerSets) {
    var i;
    for (i = 0; i < layerSets.length; i++) {
        if (isArtboard(layerSets[i])) return true;
    }
    return false;
}

function containsRegularGroups(layerSets) {
    var i;
    for (i = 0; i < layerSets.length; i++) {
        if (!isArtboard(layerSets[i])) return true;
    }
    return false;
}

function reopenRegularGroupsFromDocument(doc) {
    var topSets = getTopLevelLayerSets(doc);
    var i;

    for (i = 0; i < topSets.length; i++) {
        if (!isArtboard(topSets[i])) {
            expandGroupRecursive(topSets[i]);
        }
    }
}

function reopenArtboardsOnly(doc) {
    var topSets = getTopLevelLayerSets(doc);
    var i;

    for (i = 0; i < topSets.length; i++) {
        if (isArtboard(topSets[i])) {
            expandSingleGroup(topSets[i]);
        }
    }
}

function expandGroupRecursive(groupSet) {
    if (!groupSet || groupSet.typename !== "LayerSet") return;

    expandSingleGroup(groupSet);

    var i, child;
    for (i = 0; i < groupSet.layers.length; i++) {
        child = groupSet.layers[i];
        if (child.typename === "LayerSet") {
            // Se existir subgrupo, reabre também.
            // Em documentos normais, artboards não ficam aninhadas em grupos comuns,
            // mas deixamos a função tolerante.
            if (isArtboard(child)) {
                expandSingleGroup(child);
            } else {
                expandGroupRecursive(child);
            }
        }
    }
}

function expandSingleGroup(groupSet) {
    if (!groupSet || groupSet.typename !== "LayerSet") return;

    try {
        // Truque conhecido para expandir um grupo:
        // selecionar o primeiro filho e voltar ao grupo.
        if (groupSet.layers.length > 0) {
            app.activeDocument.activeLayer = groupSet.layers[0];
            app.activeDocument.activeLayer = groupSet;
        }
    } catch (e) {
        // Grupos vazios podem não expandir com esse método.
    }
}

function isArtboard(layer) {
    if (!layer || layer.typename !== "LayerSet") return false;

    var itemIndex = layer.itemIndex;

    try {
        if (app.activeDocument.backgroundLayer) {
            itemIndex--;
        }
    } catch (e) {}

    try {
        var ref = new ActionReference();
        ref.putIndex(stringIDToTypeID("layer"), itemIndex);
        var desc = executeActionGet(ref);
        return desc.getBoolean(stringIDToTypeID("artboardEnabled"));
    } catch (e2) {
        return false;
    }
}