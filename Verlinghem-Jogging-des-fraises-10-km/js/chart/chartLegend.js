class ChartLegend {
        
    constructor(chart, coureurCategorieIdsToCategories, keys, callback) {
        this.coureurCategorieIdsToCategories = coureurCategorieIdsToCategories; 
        this.chart = chart;
        this.callbacks = []; 
        this.addCallback(callback);
        this.initKeyVisibility(keys);
    }
    
    initKeyVisibility(keys) {
        this.keysVisibility = [];
        for (let key of keys) {
            this.keysVisibility[key] = true;
        }
        // Les clés agrégées sont masquées par défaut, sauf si elles font
        // explicitement partie de `keys` (ex: sélection préservée lors d'un redessin)
        if (!('agg_M' in this.keysVisibility)) this.keysVisibility['agg_M'] = false;
        if (!('agg_F' in this.keysVisibility)) this.keysVisibility['agg_F'] = false;
    }

    /**
     * État de démarrage pour l'affichage mixte (sex = "MF") : n'affiche que les
     * barres agrégées « Total catégories hommes » et « Total catégories femmes »,
     * toutes les catégories individuelles étant décochées. Réutilise le même chemin
     * que le clic utilisateur sur ces deux totaux, de sorte que tous les graphiques
     * dépendants (barres, cumul, temps moyen, etc.) soient mis à jour de façon cohérente.
     */
    applyDefaultSexAggregation() {
        for (var key in this.keysVisibility) {
            if (key.indexOf('agg_') === 0) continue;
            this.keysVisibility[key] = false;
            this.displayUI(key);
        }
        this.keysVisibility['agg_M'] = true;
        this.keysVisibility['agg_F'] = true;
        this.deselectAllRadios();
        d3.selectAll('.M-legend-check').attr('visibility', 'true');
        d3.selectAll('.F-legend-check').attr('visibility', 'true');
        this.callAction(this.getKeysToDisplay());
    }
    /**
     * Add a callback to be called when an item is changed
     * 
     * The callback function  must accept the items's keys array as an argument
     */
    addCallback(callback) {
        this.callbacks.push(callback);
    }
    
    callAction(keys) {
        for (let oneCallback of this.callbacks) {
            oneCallback(keys);
        }
    }
    
    /**
     * Ajoute des colonnes agrégées 'agg_M' et 'agg_F' aux données
     * (somme de toutes les catégories par sexe) et enregistre ces clés
     * dans coureurCategorieIdsToCategories.
     * À appeler avant la création des graphiques.
     *
     * @param array  data                           Données parsées par d3.csvParse
     * @param object coureurCategorieIdsToCategories Dictionnaire des catégories
     */
    static addAggregatedColumns(data, coureurCategorieIdsToCategories) {
        var mKeys = [];
        var fKeys = [];
        for (var key in coureurCategorieIdsToCategories) {
            if (coureurCategorieIdsToCategories[key].sex === 'M') mKeys.push(key);
            else if (coureurCategorieIdsToCategories[key].sex === 'F') fKeys.push(key);
        }

        data.forEach(function(d) {
            d['agg_M'] = mKeys.reduce(function(sum, k) { return sum + (+d[k] || 0); }, 0);
            d['agg_F'] = fKeys.reduce(function(sum, k) { return sum + (+d[k] || 0); }, 0);
        });

        if (data.columns.indexOf('agg_M') === -1) data.columns.push('agg_M');
        if (data.columns.indexOf('agg_F') === -1) data.columns.push('agg_F');

        // Enregistrer les clés agrégées dans le dictionnaire (pour les couleurs et labels)
        coureurCategorieIdsToCategories['agg_M'] = {
            nom: 'Total Hommes', sex: 'M',
            exaDecimalColor: '#1a237e',  // bleu marine
            ageMin: -1, ageMax: null
        };
        coureurCategorieIdsToCategories['agg_F'] = {
            nom: 'Total Femmes', sex: 'F',
            exaDecimalColor: '#880e4f',  // bordeaux
            ageMin: -1, ageMax: null
        };
    }

    static getD3ColorScale(coureurCategorieIdsToCategories) {
        let z = d3.scaleOrdinal();
        let colors = new Array();
        let keys = new Array();
    	for (var key in coureurCategorieIdsToCategories){
                    colors.push(coureurCategorieIdsToCategories[key].exaDecimalColor);   
                    keys.push(key);
        }
        z.domain(keys);
        z.range(colors);
        return z;
    }    
    
    draw(keys) {
        let coureurCategorieIdsToCategories = this.coureurCategorieIdsToCategories;
        
        this.z = ChartLegend.getD3ColorScale(coureurCategorieIdsToCategories);
        let z = this.z
        let that = this;
        
        var circleWidth = 24;
        this.circleWidth = circleWidth;
        const legendTitleHeight = 25;
        var legendY = - this.chart.layout.margin.top;
        var legend = this.chart.gd.append("g")
          .attr("class", "chart-legend")
          .attr("font-family", "sans-serif")
          .attr("font-size", 12)
          .attr("text-anchor", "end")
          .attr("transform","translate(" + (this.chart.layout.width + this.chart.layout.margin.right) + ",0)")
          .attr("height", 190);

        var currentSex = '';
        
        var legendCat = legend.selectAll("g")
        .data(keys)
        .enter().append("g")
        .attr("transform", function(d, i) { 
            if (i > 0 ) {
                legendY += 22;
            }
            if (currentSex != coureurCategorieIdsToCategories[d].sex){
                if (i > 0) {
                    legendY += 10;
                }
                if (coureurCategorieIdsToCategories[d].sex == 'M'){
                    that.drawLegendCategoryTitle(legend, 'Total catégories hommes', 'M', legendY);
                }else{
                    that.drawLegendCategoryTitle(legend, 'Total catégories femmes', 'F', legendY);
                }
                legendY += legendTitleHeight;
            }
            
            currentSex = coureurCategorieIdsToCategories[d].sex;
            return "translate(0," + legendY + ")"; }
        );

        legendCat.append("rect")
          .attr("class", function(d, i) { return 'key'+ d; })
          .attr("x", - 39 - circleWidth)
          .attr("width", 19)
          .attr("height", 19)
          .attr("stroke", z)
          .attr("fill", z);

        /* Checkbox */
         legendCat.append("text")
        .attr("x", -3 - circleWidth)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .attr("font-size", 20)
        .attr("class",  function(d, i) { return 'key key'+ d; }) 
        .attr("data-i",  function(d, i) { return d; }) 
        .html("&check;");

        var rect = legendCat.append("rect")
        .attr("x", - 20 - circleWidth)
        .attr("width", 19)
        .attr("height", 19)
        .attr("stroke", z)
        .attr("class", 'selectInterval key')
        .attr("data-i",  function(d, i) { return d; }) 
        .attr("fill", "transparent");

        
        legendCat.append("circle")
        .attr("class", function(d, i) { return 'selectOne key key_radio'+ d; })
        .attr("data-i",  function(d, i) { return d; }) 
        .attr("cx", 15 - circleWidth)
        .attr("cy", 10)
        .attr("r", 9)
        .attr("stroke", z)
        .attr("fill", "transparent");

        for (let node of legendCat.selectAll('.selectOne').nodes()){
            node.addEventListener("click", 
            function(e) {
                that.selectOne(this.dataset.i);
            });    
        }

        legendCat.append("circle")
        .attr("class", function(d, i) { return 'key_radio_point'+ d; })
        .attr("cx", 15 - circleWidth)
        .attr("cy", 10)
        .attr("r", 4)
        .attr("visibility", "hidden")
        .attr("fill", "#000000");

        legendCat.append("text")
          .attr("x", - 125 - circleWidth)
          .attr("y", 9.5)
          .attr("dy", "0.32em")			
          .attr("class", 'selectInterval key')
          .attr("data-i",  function(d, i) { return d; }) 
          .text(function(d) { return coureurCategorieIdsToCategories[d].nom; });


        legendCat.append("text")
            .attr("x", - 44 - circleWidth)
            .attr("y", 9.5)
            .attr("dy", "0.32em")
            .attr("class", 'selectInterval key')
            .attr("data-i",  function(d, i) { return d; })
            .text(function(d) { return '(' + ((coureurCategorieIdsToCategories[d].ageMax)? coureurCategorieIdsToCategories[d].ageMin + ' à ' + coureurCategorieIdsToCategories[d].ageMax + ' ans': 'plus de ' + coureurCategorieIdsToCategories[d].ageMin + ' ans' )+')'; })
            .attr('font-size', '10px');
    
        for (let node of legendCat.selectAll('.selectInterval').nodes()){
            node.addEventListener("click", 
            function(e) {
                that.selectInterval(this.dataset.i);
            });    
        }   
    }
    
    /**
     * 
     * param object legend 3ds selection
     * param string title
     * param string sex 'M' or 'F'
     * param int posY y coordinate of the title
     */
    drawLegendCategoryTitle(legend, title, sex, posY) {
        let categoryTitleLegend = legend.append("g")
            .attr("transform", "translate(" + (- 20 - this.circleWidth)+","+posY+")")
            .attr("font-family", "sans-serif")
             .attr("font-size", 12);

            categoryTitleLegend.append("rect")
              .attr("class", 'selectAllOfSex key')
              .attr("x", 0)
              .attr("y", 0)
              .attr("width", 19)
              .attr("height", 19)
              .attr("stroke", "#333333")
              .attr("fill", "transparent");

            categoryTitleLegend.append("text")
            .attr("x", 18)
            .attr("y", 9.5)
            .attr("dy", "0.32em")
            .attr("font-size", 20)
            .attr("class", "selectAllOfSex " + sex + "-legend-check key")
            .attr("visibility", "hidden")
            .html("&check;");  

            let that = this;
            for (let node of categoryTitleLegend.selectAll('.selectAllOfSex').nodes()){
                node.addEventListener("click", 
                function(e) {
                    that.selectAllOfSex(sex);
                });    
            }

            categoryTitleLegend.append("text")
            .attr("font-family", "sans-serif")
            .attr("font-size", 12)
            .attr("font-weight", "bold")
            .attr("text-anchor", "end")
            .attr("x", -10)
            .attr("y", 9.5)
            .attr("dy", "0.32em")
            .attr("class", 'selectAllOfSexExclusif key')
            .attr("fill", "#000000")
            .text(title);


            categoryTitleLegend.append("circle")
            .attr("class", 'selectAllOfSexExclusif key key_radio_' + sex )
            .attr("id", 'key_radio_' + sex)
            .attr("cx", 35)
            .attr("cy", 10)
            .attr("r", 9)
            .attr("stroke", "#333333")
            .attr("fill", "transparent");
    
            for (let node of categoryTitleLegend.selectAll('.selectAllOfSexExclusif').nodes()){
                node.addEventListener("click", 
                function(e) {
                    that.selectAllOfSex(sex, true);
                });    
            }

            categoryTitleLegend.append("circle")
            .attr("class", 'key key_radio_point_' + sex)
            .attr("id", 'key_radio_point_' + sex)
            .attr("cx", 35)
            .attr("cy", 10)
            .attr("r", 4)
            .attr("visibility", "hidden")
            .attr("fill", "#000000");        
    }
    
    /**
     * Toggle the visibility of the item indentified by key 
     * param string key
     */
    selectInterval(key) {
        var cat = this.coureurCategorieIdsToCategories[key];
        if (cat) {
            var aggKey = 'agg_' + cat.sex;
            // Si "Toutes categories" du même sexe est actif, le désactiver sans toucher aux autres catégories
            if (this.keysVisibility[aggKey]) {
                this.keysVisibility[aggKey] = false;
                d3.selectAll('.' + cat.sex + '-legend-check').attr('visibility', 'hidden');
            }
        }

        this.keysVisibility[key] = !this.keysVisibility[key];
        this.displayUI(key);
        this.deselectAllRadios();
        this.callAction(this.getKeysToDisplay());
    }

    deselectAllRadios() {
	for (var key in this.keysVisibility){
		d3.selectAll('.key_radio_point'+key).attr('visibility', 'hidden');
	}	
	d3.selectAll('.key_radio_point_M').attr('visibility', 'hidden');
	d3.selectAll('.key_radio_point_F').attr('visibility', 'hidden');
    }

    selectOne(key) {
	this.keysVisibility[key] = true;
	d3.selectAll('.key_radio_point'+key).attr('visibility', 'true');
	
            for (var i in this.keysVisibility){
                if (i != key) {
			this.keysVisibility[i] = false;
			d3.selectAll('.key_radio_point'+i).attr('visibility', 'hidden');
                        d3.selectAll('.key'+i).attr('visibility', 'hidden');
                }        
            }
		
	this.displayUI(key);
	
	d3.selectAll('.M-legend-check').attr('visibility', 'hidden');
	d3.selectAll('.F-legend-check').attr('visibility', 'hidden');
	d3.selectAll('.key_radio_point_M').attr('visibility', 'hidden');
	d3.selectAll('.key_radio_point_F').attr('visibility', 'hidden');
	
	this.callAction(this.getKeysToDisplay());
    }
/*
    selectAll() {
	var keys = new Array();
	for (var j=1; j < keysVisibility.length; j++){
		this.keysVisibility[j] = true;
		this.displayUI(j);
		keys.push(dataglobal.columns[j]);
	}
	this.deselectAllRadios();
	
	this.callAction(keys);
    }
*/
    selectAllOfSex(sex, deselectOther) {

        // Mode exclusif (clic sur le radio) : afficher une barre agrégée unique
        if (deselectOther) {
            // Masquer toutes les catégories individuelles et réinitialiser les agrégées
            for (var key in this.keysVisibility) {
                this.keysVisibility[key] = false;
                this.displayUI(key);
            }
            this.keysVisibility['agg_M'] = false;
            this.keysVisibility['agg_F'] = false;
            this.deselectAllRadios();
            d3.selectAll('.key_radio_point_' + sex).attr('visibility', 'true');
            d3.selectAll('.' + sex + '-legend-check').attr('visibility', 'hidden');
            d3.selectAll('.' + ((sex == 'M') ? 'F' : 'M') + '-legend-check').attr('visibility', 'hidden');
            // Passer la clé agrégée au callback — le graphique affiche une seule barre totale
            this.callAction(['agg_' + sex]);
            return;
        }

        // Mode checkbox : bascule entre barre agrégée et catégories individuelles
        var aggKey = 'agg_' + sex;
        var newAggVisibility = !this.keysVisibility[aggKey];

        if (newAggVisibility) {
            // Activation "Toutes" → désactiver toutes les catégories individuelles du même sexe
            for (var k in this.keysVisibility) {
                if (k.indexOf('agg_') === 0) continue;
                if (this.coureurCategorieIdsToCategories[k] && this.coureurCategorieIdsToCategories[k].sex === sex) {
                    this.keysVisibility[k] = false;
                    this.displayUI(k);
                }
            }
            this.keysVisibility[aggKey] = true;
        } else {
            // Désactivation "Toutes" → réactiver toutes les catégories individuelles du même sexe
            this.keysVisibility[aggKey] = false;
            for (var k in this.keysVisibility) {
                if (k.indexOf('agg_') === 0) continue;
                if (this.coureurCategorieIdsToCategories[k] && this.coureurCategorieIdsToCategories[k].sex === sex) {
                    this.keysVisibility[k] = true;
                    this.displayUI(k);
                }
            }
        }

        this.deselectAllRadios();
        d3.selectAll('.' + sex + '-legend-check').attr('visibility', newAggVisibility ? 'true' : 'hidden');
        this.callAction(this.getKeysToDisplay());
    }
    
    getKeysToDisplay() {
	var keys = new Array();
	for (var key in this.coureurCategorieIdsToCategories){
		if (this.keysVisibility[key]) {
			keys.push(key);
		}
	}	
	return keys;
    }
    
    displayUI(i) { 
	d3.selectAll('.key'+i).attr('visibility', this.keysVisibility[i]?'true':'hidden');	
    }
}