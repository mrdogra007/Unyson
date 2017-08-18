(function($) {
	window.fwOptionTypeIconV2Picker = fw.Modal.extend({
		defaults: _.extend({}, fw.Modal.prototype.defaults, {
			title: 'Icon V2',
			size: 'small',
			modalCustomClass: 'fw-icon-v2-picker-modal',
			emptyHtmlOnClose: false,
		}),

		ContentView: fw.Modal.prototype.ContentView.extend({
			events: {
				'input .fw-icon-v2-icons-library .fw-icon-v2-toolbar input':
					'onSearch',
				'click .fw-icon-v2-library-icon': 'markIconAsSelected',
				'click .fw-icon-v2-library-icon a': 'markIconAsFavorite',
				'click button.fw-icon-v2-custom-upload-perform': 'performImageUpload',
				submit: 'onSubmit',
			},

			initialize: function() {
				fw.Modal.prototype.ContentView.prototype.initialize.call(this);

				// keep track of current searches for better performance
				this.previousSearch = '';

				this.throttledApplyFilters = _.throttle(
					_.bind(this.model.applyFilters, this.model),
					200
				);
			},

			onSubmit: function(e) {
				this.model.resolveResult();

				var content = this;

				e.preventDefault();

				setTimeout(function() {
					content.model.frame.modal.$el
						.find('.media-modal-close')
						.trigger('click');
				}, 0);
			},

			performImageUpload: function () {
				var vm = this;

				var uploadFrame = wp.media({
					library: {
						type: 'image',
					},

					states: new wp.media.controller.Library({
						library: wp.media.query({ type: 'image' }),
						multiple: true,
						filterable: 'uploaded',
						content: 'upload',
						title: 'Select Image',
						priority: 20,
					}),
				});

				uploadFrame.on('ready', function () {
					uploadFrame.modal.$el.addClass('fw-option-type-upload');
				});

				uploadFrame.off('select');

				uploadFrame.on('select', function () {
					var attachments = uploadFrame.state().get('selection').toArray();

					attachments.map(function (attachment) {
						if (! _.contains(
							vm.model.currentFavorites,
							attachment.id.toString()
						)) {
							vm.model.markAsFavorite(attachment.id.toString());
						}
					});

					vm.renderFavoritesAndRecentUploads();

					uploadFrame.detach();
				});

				uploadFrame.open();
			},

			markIconAsSelected: function markIconAsSelected(e) {
				e.preventDefault();

				var $el = $(e.currentTarget);

				this.model.result['icon-class'] = $el
					.attr('data-fw-icon-v2')
					.trim();

				this.refreshSelectedIcon();
			},

			refreshSelectedIcon: function refreshSelectedIcon() {
				var currentValue = this.model.result['icon-class'];

				this.model.frame.$el
					.find('.fw-icon-v2-library-icon.selected')
					.removeClass('selected');

				if (currentValue) {
					this.model.frame.$el
						.find('[data-fw-icon-v2$="' + currentValue + '"]')
						.addClass('selected');
				}
			},

			markIconAsFavorite: function markIconAsFavorite(e) {
				e.preventDefault();
				e.stopPropagation();

				var icon = $(e.currentTarget)
					.closest('.fw-icon-v2-library-icon')
					.attr('data-fw-icon-v2');

				this.model.markAsFavorite(icon);

				this.renderFavoritesAndRecentUploads();
				this.refreshFavorites();
			},

			refreshFavorites: function() {
				$('.fw-icon-v2-favorite').removeClass('fw-icon-v2-favorite');

				_.map(this.model.currentFavorites, function(favorite) {
					$('[data-fw-icon-v2="' + favorite + '"]').addClass(
						'fw-icon-v2-favorite'
					);
				});
			},

			renderFavoritesAndRecentUploads: function() {
				this.model.frame.$el.find(
					'.fw-icon-v2-icon-favorites'
				).replaceWith(this.model.getFavoritesHtml());

				this.model.frame.$el.find(
					'.fw-icon-v2-icon-recent-uploads'
				).replaceWith(this.model.getRecentIconsHtml());
			},

			onSearch: function(event) {
				var $el = $(event.currentTarget);

				if (
					this.previousSearch.trim().length === 0 &&
					$el.val().trim().length === 0
				) {
					return;
				}

				if ($el.val().trim().length === 0) {
					this.throttledApplyFilters();
				}

				if ($el.val().trim().length > 2) {
					this.throttledApplyFilters();
				}

				this.previousSearch = $el.val();
			},
		}),

		initialize: function(attributes, settings) {
			fw.Modal.prototype.initialize.call(this, attributes, settings);

			var modal = this;

			this.currentFavorites = null;

			this.result = {};

			jQuery
				.when(this.loadIconsData(), this.loadLatestFavorites())
				.then(_.bind(this.setHtml, this));

			this.frame.on('close', _.bind(this.rejectResultAndResetIt, this));

			this.frame.once('ready', function() {
				modal.frame.$el
					.find('.fw-options-tabs-wrapper')
					.on('tabsactivate', function(event, ui) {
						/**
						 * Every tab change should cause a change on a modal.
						 *
						 * It may be the case that the user will switch to
						 * `Custom Upload` and the value of the option type won't change
						 * because of the fact that `change:values` callback will not
						 * be executed.
						 */
						modal.result.type =
							ui.newTab.index() === 2
								? 'custom-upload'
								: 'icon-font';
					});
			});
		},

		resolveResult: function() {
			if (this.promise) {
				this.promise.resolve(this.result);
			}

			this.promise = null;
		},

		rejectResultAndResetIt: function() {
			if (this.promise) {
				this.promise.reject(this.result);
			}

			this.promise = null;
		},

		initializeFrame: function(settings) {
			fw.OptionsModal.prototype.initializeFrame.call(this, settings);
		},

		setHtml: function() {
			this.set('html', this.getTabsHtml());
		},

		open: function(values) {
			this.promise = jQuery.Deferred();

			var modal = this;

			this.get('controls_ready') &&
				this.set('controls_ready', !!this.frame.state());

			values = values || {
				type: 'icon-font',
				'icon-class': '',
			};

			if (values.type === 'none') {
				values.type = 'icon-font';
			}

			this.set('current_state', values);
			this.result = this.get('current_state');

			if (this.frame.state()) {
				this.prepareForPick();
			}

			this.frame.open();

			/**
			 * On first open, modal is prepared here.
			 */
			if (!this.get('controls_ready')) {
				setTimeout(_.bind(this.prepareForPick, this), 0);

				this.frame.$el.find('.fw-icon-v2-toolbar select').selectize({
					onChange: _.bind(this.applyFilters, this),
				});

				this.content.refreshFavorites();
			}

			return this.promise;
		},

		close: function() {
			fw.Modal.prototype.close.call(this);
		},

		prepareForPick: function() {
			// use this.get('current_state') in order to populate current
			// active icon or current attachment
			//
			// this.frame.$el.find('.ui-tabs').tabs({active: 2});

			var $tabs = this.frame.$el.find('.ui-tabs');

			var currentTab = $tabs.tabs('option', 'active');

			if (this.get('current_state').type === 'custom-upload') {
				if (currentTab !== 2) {
					$tabs.tabs({ active: 2 });
				}
			}

			if (this.get('current_state').type !== 'custom-upload') {
				if (currentTab === 2) {
					$tabs.tabs({ active: 0 });
				}

				this.maybeResetFiltersForIcon();

				this.content.refreshSelectedIcon();

				// TODO: scroll into view for both uploads and the rest of the
				// icons
				return;

				if (this.result['icon-class']) {
					var el = this.frame.$el.find(
						'[data-fw-icon-v2$="' + this.result['icon-class'] + '"]'
					)[0];

					if (el.scrollIntoViewIfNeeded) {
						el.scrollIntoViewIfNeeded(true);
					} else if (el.scrollIntoView) {
						el.scrollIntoView();
					}
				}
			}
		},

		maybeResetFiltersForIcon: function () {
			if (! this.result['icon-class']) return;

			var packForIcon = _.findWhere(_.values(this.getIconsData()), {
				css_class_prefix: this.result['icon-class'].split(' ')[0]
			});

			console.log(packForIcon);
		},

		applyFilters: function() {
			var pack = this.frame.$el.find(
				'.fw-icon-v2-icons-library .fw-icon-v2-toolbar select'
			)[0].value;

			var search = this.frame.$el
				.find('.fw-icon-v2-icons-library .fw-icon-v2-toolbar input')
				.val()
				.trim();

			var packs = this.getFilteredPacks({
				pack: pack,
				search: search,
			});

			this.frame.$el.find('.fw-icon-v2-library-packs-wrapper').html(
				wp.template('fw-icon-v2-packs')({
					packs: packs,
					current_state: this.result,
					favorites: this.currentFavorites,
				})
			);
		},

		getFilteredPacks: function(filters) {
			var self = this;

			filters = _.extend(
				{},
				{
					search: '',
					pack: '',
				},
				filters
			);

			var packs = [];

			if (filters.pack.trim() === '' || filters.pack === 'all') {
				packs = [ _.first(_.values(this.getIconsData())) ];
			} else {
				packs = [this.getIconsData()[filters.pack]];
			}

			packs = _.map(packs, function(pack) {
				var newPack = _.extend({}, pack);

				newPack.icons = _.filter(pack.icons, function(icon) {
					return self.fuzzyConsecutive(filters.search, icon);
				});

				return newPack;
			});

			return _.reject(packs, _.isEmpty);
		},

		loadIconsData: function() {
			if (this.iconsDataPromise) {
				return this.iconsDataPromise;
			}

			this.iconsDataPromise = jQuery.post(ajaxurl, {
				action: 'fw_icon_v2_get_icons',
			});

			this.iconsDataPromise.then(_.bind(this.preloadFonts, this));

			return this.iconsDataPromise;
		},

		getIconsData: function() {
			this.loadIconsData();

			if (this.iconsDataPromise.state() === 'resolved') {
				if (this.iconsDataPromise.responseJSON.success) {
					return this.iconsDataPromise.responseJSON.data;
				}
			}

			return null;
		},

		loadLatestFavorites: function() {
			var modal = this;

			if (modal.favoritesPromise) {
				return modal.favoritesPromise;
			}

			modal.favoritesPromise = $.Deferred();

			var ajaxPromise = $.post(ajaxurl, {
				action: 'fw_icon_v2_get_favorites',
			});

			ajaxPromise.then(function() {
				if (ajaxPromise.state() === 'resolved') {
					ajaxPromise = _.uniq(
						ajaxPromise.responseJSON
					);
				}

				var recent_uploads = _.filter(
					ajaxPromise.responseJSON,
					_.compose(_.negate(_.isNaN), _.partial(parseInt, _, 10))
				);

				if (recent_uploads.length === 0) {
					modal.favoritesPromise.resolve();
					return;
				}

				console.log(recent_uploads);

				modal.preloadMultipleAttachments(recent_uploads).then(function () {
					modal.favoritesPromise.resolve();
				});
			});

			return modal.favoritesPromise;
		},

		preloadMultipleAttachments: function (attachment_ids) {
			if (jQuery.when.all===undefined) {
				jQuery.when.all = function(deferreds) {
					var deferred = new jQuery.Deferred();
					$.when.apply(jQuery, deferreds).then(
						function() {
							deferred.resolve(Array.prototype.slice.call(arguments));
						},
						function() {
							deferred.fail(Array.prototype.slice.call(arguments));
						});

					return deferred;
				}
			}

			return jQuery.when.all(
				attachment_ids.filter(function (attachment_id) {
					return ! wp.media.attachment(attachment_id).get('url');
				}).map(function (id) {
					return wp.attachment(id).fetch();
				})
			);
		},

		markAsFavorite: function(icon) {
			icon = icon.trim();

			var modal = this;

			var isFavorite = _.contains(modal.currentFavorites, icon);

			if (isFavorite) {
				modal.currentFavorites = _.uniq(
					_.reject(modal.currentFavorites, function(favorite) {
						return favorite == icon;
					})
				);
			} else {
				modal.currentFavorites.push(icon);
			}

			jQuery.post(ajaxurl, {
				action: 'fw_icon_v2_update_favorites',
				favorites: JSON.stringify(_.uniq(modal.currentFavorites)),
			});
		},

		preloadFonts: function() {
			_.map(this.getIconsData(), preloadFont);

			function preloadFont(pack) {
				var $el = jQuery(
					'<i class="' +
						pack.css_class_prefix +
						' ' +
						pack.icons[0] +
						'" style="opacity: 0;">'
				);

				jQuery('body').append($el);

				setTimeout(function() {
					$el.remove();
				}, 200);
			}
		},

		getTabsHtml: function() {

			return wp.template('fw-icon-v2-tabs')({
				icons_library_html: this.getLibraryHtml(),
				favorites_list_html: this.getFavoritesHtml(),
				recently_used_custom_uploads_html: this.getRecentIconsHtml(),
				current_state: this.result,
				favorites: this.currentFavorites,
			});

		},

		getLibraryHtml: function() {

			var packs = _.values(this.getIconsData());
			var pack_to_select = [ _.first(packs) ];

			return wp.template('fw-icon-v2-library')({
				packs: _.values(this.getIconsData()),
				pack_to_select: pack_to_select,
				current_state: this.result,
				favorites: this.currentFavorites,
			});
		},

		getFavoritesHtml: function() {
			return wp.template('fw-icon-v2-favorites')({
				favorites: this.currentFavorites,
				current_state: this.result,
			});
		},

		getRecentIconsHtml: function () {
			return wp.template('fw-icon-v2-recent-custom-icon-uploads')({
				favorites: this.currentFavorites,
				current_state: this.result,
			});
		},

		fuzzyConsecutive: function fuzzyConsecutive(query, search) {
			if (query.trim() === '') return true;

			return (
				search.toLowerCase().trim().indexOf(query.toLowerCase()) > -1
			);
		},
	});

	fwOptionTypeIconV2Instance = new fwOptionTypeIconV2Picker();
})(jQuery);
